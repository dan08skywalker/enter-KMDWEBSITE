import { useEffect, useMemo, useState } from "react";
import { Receipt, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { toast } from "sonner";
import { PageHeader } from "@/components/kmd/page-header";
import { ExportButton } from "@/components/kmd/export-button";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { Points } from "@/components/kmd/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus, transactionType } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { PointLedgerRow } from "@/lib/kmd/types";

export default function AdminPointTransactions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PointLedgerRow[]>([]);
  const [level, setLevel] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("point_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) console.error("Could not load the point ledger:", error.message);
    setRows((data ?? []) as unknown as PointLedgerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["point_ledger"], () => void load());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (toTime !== null && at > toTime) return false;
      if (level !== "all" && String(row.unilevel_level) !== level) return false;
      if (type !== "all" && row.transaction_type !== type) return false;
      if (status !== "all" && row.status !== status) return false;
      if (needle) {
        const haystack = `${row.transaction_id} ${row.order_id ?? ""} ${row.buyer_member_code ?? ""} ${
          row.beneficiary_member_code
        } ${row.sku ?? ""} ${row.product_name ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, level, type, status, from, to, search]);

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;
    for (const row of filtered) {
      if (row.status !== "posted") continue;
      if (row.direction === "CREDIT") credits += toNumber(row.total_points);
      else debits += toNumber(row.total_points);
    }
    return { credits, debits };
  }, [filtered]);

  const reverse = async (ledgerId: string, reason?: string) => {
    const outcome = await invokeFunction("admin-actions", {
      action: "reverse_reward",
      ledgerId,
      reason,
    });
    if (!outcome.ok) {
      toast.error("Could not reverse the reward", { description: outcome.error });
      return { error: outcome.error };
    }
    toast.success("Reversal posted as a new offsetting ledger entry");
    await load();
    return {};
  };

  const columns: Column<PointLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "txn",
      header: "Transaction ID",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    {
      key: "order",
      header: "Order ID",
      cell: (row) => (
        <span className="font-mono text-xs">{row.order_id ? `${row.order_id.slice(0, 8)}\u2026` : "\u2014"}</span>
      ),
    },
    { key: "buyer", header: "Buyer", cell: (row) => <span className="font-mono text-xs">{row.buyer_member_code ?? "\u2014"}</span> },
    { key: "beneficiary", header: "Beneficiary", cell: (row) => <span className="font-mono text-xs">{row.beneficiary_member_code}</span> },
    { key: "product", header: "Product/Package", cell: (row) => row.product_name ?? "\u2014" },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku ?? "\u2014"}</span> },
    { key: "qty", header: "Qty", cell: (row) => row.quantity ?? "\u2014", className: "text-right" },
    {
      key: "level",
      header: "Level",
      cell: (row) => (row.unilevel_level ? `Level ${row.unilevel_level}` : "\u2014"),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => {
        const descriptor = transactionType(row.transaction_type);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "points",
      header: "Points",
      cell: (row) => <Points value={row.total_points} direction={row.direction} showSign />,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = ledgerStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) =>
        row.direction === "CREDIT" && row.status === "posted" && row.transaction_type !== "REVERSAL" ? (
          <ConfirmActionDialog
            trigger={
              <Button variant="ghost" size="sm">
                <Undo2 className="h-3.5 w-3.5" />
                Reverse
              </Button>
            }
            title={`Reverse ${row.transaction_id}?`}
            description="Historical ledger rows are never edited or deleted. A new offsetting REVERSAL entry is written and the beneficiary's balance is reduced by the same amount."
            confirmLabel="Post reversal"
            destructive
            reasonRequired
            reasonLabel="Reason for the reversal"
            onConfirm={(reason) => reverse(row.id, reason)}
          />
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Point Transactions"
        description="The administrator view of the entire Point Ledger, including redemptions, conversions, adjustments and reversals."
        actions={<ExportButton dataset="point_ledger" filters={{ search: search || null }} />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="points-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="points-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search transaction, order, member or SKU" />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="points-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input id="points-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="points-to" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input id="points-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[150px]" />
          </div>
        </div>
        <SelectFilter
          value={level}
          onChange={setLevel}
          allLabel="All levels"
          options={UNILEVEL_LEVELS.map((value) => ({ value: String(value), label: `Level ${value}` }))}
        />
        <SelectFilter
          value={type}
          onChange={setType}
          allLabel="All types"
          options={[
            { value: "UNILEVEL_BONUS", label: "Unilevel Bonus" },
            { value: "REDEMPTION", label: "Redemption" },
            { value: "SHOPPING_WALLET_CONVERSION", label: "Wallet Conversion" },
            { value: "ADMIN_ADJUSTMENT", label: "Admin Adjustment" },
            { value: "REVERSAL", label: "Reversal" },
          ]}
          className="sm:w-[190px]"
        />
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "posted", label: "Posted" },
            { value: "pending", label: "Held" },
            { value: "reversed", label: "Reversed" },
          ]}
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{filtered.length}</span> rows
        </span>
        <span>
          Credits <span className="font-semibold text-[hsl(var(--success))]">{formatPoints(totals.credits)}</span>
        </span>
        <span>
          Debits <span className="font-semibold text-destructive">{formatPoints(totals.debits)}</span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={Receipt} title="No ledger rows" description="No point activity matches these filters." />}
      />
    </>
  );
}
