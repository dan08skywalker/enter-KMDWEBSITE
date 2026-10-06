import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { Points } from "@/components/kmd/amount";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow } from "@/lib/kmd/types";

export default function MemberLoyaltyCredits() {
  const ledger = useMemberLedger();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const lifetime = useMemo(
    () =>
      ledger.loyaltyRows
        .filter((row) => row.direction === "CREDIT" && row.status === "posted")
        .reduce((sum, row) => sum + toNumber(row.credit_amount), 0),
    [ledger.loyaltyRows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return ledger.loyaltyRows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (toTime !== null && at > toTime) return false;
      if (status !== "all" && row.status !== status) return false;
      if (needle) {
        const haystack = `${row.transaction_id} ${row.order_id ?? ""} ${row.buyer_member_code ?? ""} ${
          row.product_name ?? ""
        } ${row.sku ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [ledger.loyaltyRows, from, to, status, search]);

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
        <span className="font-mono text-xs">
          {row.order_id ? `${row.order_id.slice(0, 8)}\u2026` : "\u2014"}
        </span>
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
        title="Loyalty Credits"
        description="Loyalty Credits are recorded in their own ledger and balance, separate from your Unilevel Points."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Loyalty Credits Balance"
          value={formatPoints(ledger.loyaltyCredits)}
          hint="Available to redeem"
          icon={Sparkles}
          accent="gold"
          loading={ledger.loading}
        />
        <StatCard
          label="Lifetime Loyalty Credits"
          value={formatPoints(lifetime)}
          hint={`${ledger.loyaltyRows.length} ledger entries`}
          accent="primary"
          loading={ledger.loading}
        />
        <StatCard
          label="Ledger Separation"
          value="Separate"
          hint="Loyalty Credits never mix with Unilevel Points"
          accent="platinum"
          loading={false}
        />
      </div>

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Every loyalty award creates a row in the loyalty credit ledger and updates the loyalty
          balance. It does not touch the point ledger, so an adjustment to one can never distort the
          other.
        </p>
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search transaction, order or product" />
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

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={ledger.loading}
        empty={
          <EmptyState
            icon={Sparkles}
            title="No loyalty credit entries"
            description="Loyalty Credits are configured per product by an administrator; none have been awarded to you yet."
          />
        }
      />
    </>
  );
}
