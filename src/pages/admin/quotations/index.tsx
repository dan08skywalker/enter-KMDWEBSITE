import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Plus, Receipt, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { formatDate, formatPeso } from "@/lib/kmd/format";
import { QUOTATION_STATUS_LABEL, mapQuotation, type Quotation, type QuotationStatus } from "@/lib/digital/types";

const STATUS_TONE: Record<QuotationStatus, "neutral" | "info" | "success" | "danger"> = {
  draft: "neutral",
  issued: "info",
  accepted: "success",
  void: "danger",
};

export default function AdminQuotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .order("quotation_date", { ascending: false })
      .order("quotation_number", { ascending: false });

    setLoading(false);
    if (error) {
      console.error("Could not load the quotations:", error.message);
      toast.error("The quotations could not be loaded");
      setQuotations([]);
      return;
    }
    setQuotations(((data ?? []) as Array<Record<string, unknown>>).map(mapQuotation));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh(["quotations"], () => {
    void load();
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return quotations;
    return quotations.filter((quotation) =>
      [quotation.quotationNumber, quotation.clientName, quotation.businessName ?? "", quotation.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [quotations, query]);

  const columns: Column<Quotation>[] = [
    {
      key: "number",
      header: "Quotation",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold">{row.quotationNumber}</span>
          <span className="text-[10px] text-muted-foreground">{formatDate(row.quotationDate)}</span>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{row.clientName}</span>
          <span className="text-[10px] text-muted-foreground">{row.businessName ?? row.email ?? "\u2014"}</span>
        </div>
      ),
    },
    {
      key: "lines",
      header: "Lines",
      cell: (row) => <span className="text-xs tabular-nums">{row.items.length}</span>,
      className: "text-right",
    },
    {
      key: "total",
      header: "Contract price",
      cell: (row) => (
        <span className="text-xs font-semibold tabular-nums">{formatPeso(row.totalContractPrice)}</span>
      ),
      className: "text-right",
    },
    {
      key: "separate",
      header: "Billed separately",
      cell: (row) => (
        <span className="text-xs tabular-nums">
          {row.separateFeesTotal > 0 ? formatPeso(row.separateFeesTotal) : "\u2014"}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "terms",
      header: "Payment terms",
      cell: (row) => (
        <span className="text-[11px]">
          {row.paymentTermsMode === "project_50_50" ? "50% / 50% project" : "Product terms"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge label={QUOTATION_STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button asChild variant="outline" size="sm" className="h-7 text-[11px]">
          <Link to={`/admin/quotations/${row.id}`}>Open</Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Quotations"
        description="Written quotations prepared from the client requests. Every figure is calculated on the server from the saved line items, so the preview, the Word file, the PDF and the printed copy always agree."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button onClick={() => navigate("/admin/quotations/new")}>
              <Plus className="h-4 w-4" />
              New quotation
            </Button>
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a quotation number or client"
            className="pl-8"
          />
        </div>
        <Button asChild variant="ghost" size="sm" className="text-accent">
          <Link to="/admin/digital-requests">
            <Receipt className="h-3.5 w-3.5" />
            Client requests
          </Link>
        </Button>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              icon={FileText}
              title="No quotation yet"
              description="Open a client request and choose Prepare quotation to draft the first one."
            />
          }
        />
      </div>
    </>
  );
}
