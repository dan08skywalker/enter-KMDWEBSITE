import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { Points } from "@/components/kmd/amount";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus, transactionType } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { PointLedgerRow } from "@/lib/kmd/types";

export default function MemberPointTransactions() {
  const ledger = useMemberLedger();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [level, setLevel] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [product, setProduct] = useState("all");
  const [search, setSearch] = useState("");

  const products = useMemo(
    () =>
      Array.from(new Set(ledger.pointRows.map((row) => row.product_name).filter(Boolean))) as string[],
    [ledger.pointRows],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : null;

    return ledger.pointRows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (toTime !== null && at > toTime) return false;
      if (level !== "all" && String(row.unilevel_level) !== level) return false;
      if (type !== "all" && row.transaction_type !== type) return false;
      if (status !== "all" && row.status !== status) return false;
      if (product !== "all" && row.product_name !== product) return false;
      if (needle) {
        const haystack = `${row.transaction_id} ${row.order_id ?? ""} ${row.buyer_member_code ?? ""} ${
          row.sku ?? ""
        } ${row.product_name ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [ledger.pointRows, from, to, level, type, status, product, search]);

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
        <span className="font-mono text-xs">
          {row.order_id ? `${row.order_id.slice(0, 8)}\u2026` : "\u2014"}
        </span>
      ),
    },
    { key: "buyer", header: "Buyer", cell: (row) => <span className="font-mono text-xs">{row.buyer_member_code ?? "\u2014"}</span> },
    { key: "product", header: "Product/Package", cell: (row) => row.product_name ?? "\u2014" },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku ?? "\u2014"}</span> },
    { key: "qty", header: "Qty", cell: (row) => row.quantity ?? "\u2014", className: "text-right" },
    { key: "level", header: "Level", cell: (row) => (row.unilevel_level ? `Level ${row.unilevel_level}` : "\u2014") },
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
  ];

  return (
    <>
      <PageHeader
        title="Point Transactions"
        description="Every point movement in your account, posted straight from the ledger."
      />

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search transaction, order, buyer or SKU" />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="pt-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input id="pt-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-to" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input id="pt-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[150px]" />
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
          className="sm:w-[200px]"
        />
        <SelectFilter
          value={product}
          onChange={setProduct}
          allLabel="All products"
          options={products.map((value) => ({ value, label: value }))}
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
          <span className="font-semibold text-foreground">{filtered.length}</span> entries
        </span>
        <span>
          Credits <span className="font-semibold text-[hsl(var(--success))]">{formatPoints(totals.credits)}</span>
        </span>
        <span>
          Debits <span className="font-semibold text-destructive">{formatPoints(totals.debits)}</span>
        </span>
        <span>
          Net{" "}
          <span className="font-semibold text-foreground">
            {formatPoints(totals.credits - totals.debits)}
          </span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={ledger.loading}
        empty={
          <EmptyState
            icon={Receipt}
            title="No point transactions"
            description="Your ledger is empty. Points appear here the moment a qualified purchase in your team is processed."
          />
        }
      />
    </>
  );
}
