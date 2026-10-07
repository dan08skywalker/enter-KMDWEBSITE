import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { ExportButton } from "@/components/kmd/export-button";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { Points } from "@/components/kmd/amount";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow } from "@/lib/kmd/types";

export default function AdminLoyaltyTransactions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LoyaltyLedgerRow[]>([]);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("loyalty_credit_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) console.error("Could not load the loyalty ledger:", error.message);
    setRows((data ?? []) as unknown as LoyaltyLedgerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["loyalty_credit_ledger"], () => void load());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (toTime !== null && at > toTime) return false;
      if (status !== "all" && row.status !== status) return false;
      if (needle) {
        const haystack = `${row.transaction_id} ${row.order_id ?? ""} ${row.buyer_member_code ?? ""} ${
          row.beneficiary_member_code
        } ${row.sku ?? ""} ${row.product_name ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, from, to, search]);

  const totalCredit = useMemo(
    () =>
      filtered
        .filter((row) => row.status === "posted" && row.direction === "CREDIT")
        .reduce((sum, row) => sum + toNumber(row.credit_amount), 0),
    [filtered],
  );

  const columns: Column<LoyaltyLedgerRow>[] = [
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
    { key: "product", header: "Product", cell: (row) => row.product_name ?? "\u2014" },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku ?? "\u2014"}</span> },
    {
      key: "amount",
      header: "Credit Amount",
      cell: (row) => <Points value={row.credit_amount} direction={row.direction} showSign />,
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
  ];

  return (
    <>
      <PageHeader
        title="Loyalty Transactions"
        description="The Loyalty Credit ledger, shown separately from Unilevel point activity."
        actions={<ExportButton dataset="loyalty_ledger" />}
      />

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Loyalty Credits live entirely in this ledger and its own balance. Unilevel bonuses never appear
          here, and loyalty awards never appear in the point ledger — the two can be reconciled
          independently.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="loyalty-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="loyalty-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search transaction, order, member or SKU" />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="loyalty-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input id="loyalty-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="loyalty-to" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input id="loyalty-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[150px]" />
          </div>
        </div>
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
          Total credited{" "}
          <span className="font-semibold text-[hsl(var(--gold))]">{formatPoints(totalCredit)}</span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={Sparkles}
            title="No loyalty transactions"
            description="No loyalty credit has been awarded yet. Configure a Loyalty Credit value in Reward Configuration to start issuing them."
          />
        }
      />
    </>
  );
}
