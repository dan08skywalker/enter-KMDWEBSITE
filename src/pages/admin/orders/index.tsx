import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { ExportButton } from "@/components/kmd/export-button";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatPeso, formatPoints } from "@/lib/kmd/format";
import { orderStatus } from "@/lib/kmd/labels";
import type { Order, OrderItem } from "@/lib/kmd/types";

interface OrderRow extends Order {
  order_items: OrderItem[];
}

export default function AdminOrders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  /** order id -> authoritative reward status derived from the reward ledgers. */
  const [rewardStatus, setRewardStatus] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);
  const [integrity, setIntegrity] = useState<{
    suspectedDuplicateCredits: unknown[];
    unflaggedWithRewards: string[];
    incompleteNeedingRetry: string[];
    historicalConfigurationDifferences: unknown[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) {
      console.error("Could not load orders:", error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as OrderRow[];
    setOrders(rows);
    setLoading(false);

    // The saved reward status comes from the ledgers — the same source the approval
    // screen reads — so the two tabs can never disagree.
    if (rows.length > 0) {
      const outcome = await invokeFunction<{ result?: Record<string, { status?: string }> }>(
        "admin-actions",
        { action: "reward_status", orderIds: rows.map((row) => row.id) },
      );
      if (outcome.ok) {
        setRewardStatus(
          Object.fromEntries(
            Object.entries(outcome.data?.result ?? {}).map(([id, entry]) => [id, entry.status ?? ""]),
          ),
        );
      }
    }
  }, [includeTest]);

  useEffect(() => {
    void load();
  }, [load]);

  // Confirming a payment in the approval tab writes the order, its ledgers and its
  // status in one transaction; this subscription is what makes this tab show
  // "Rewards processed" immediately, with no second confirmation and no reload.
  useRealtimeRefresh(
    ["orders", "point_ledger", "loyalty_credit_ledger", "payment_proofs"],
    () => void load(),
  );

  // Read once: duplicates, missing legacy labels and genuinely incomplete orders.
  useEffect(() => {
    void (async () => {
      const outcome = await invokeFunction<{
        result?: {
          suspectedDuplicateCredits: unknown[];
          unflaggedWithRewards: string[];
          incompleteNeedingRetry: string[];
          historicalConfigurationDifferences: unknown[];
        };
      }>("admin-actions", { action: "reward_integrity" });
      if (outcome.ok && outcome.data?.result) setIntegrity(outcome.data.result);
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (needle) {
        const items = (order.order_items ?? [])
          .map((item) => `${item.sku} ${item.product_name}`)
          .join(" ");
        const haystack = `${order.order_number} ${order.buyer_member_code} ${items}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, status, search]);

  const counts = useMemo(() => {
    const awaiting = orders.filter((order) => ["proof_submitted", "under_review"].includes(order.status)).length;
    const confirmed = orders.filter((order) => order.status === "confirmed").length;
    const rewardsPending = orders.filter(
      (order) => order.status === "confirmed" && !order.rewards_processed,
    ).length;
    return { awaiting, confirmed, rewardsPending };
  }, [orders]);

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: "Order Number",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.order_number}</span>,
    },
    {
      key: "buyer",
      header: "Buyer",
      cell: (row) => <span className="font-mono text-xs">{row.buyer_member_code}</span>,
    },
    {
      key: "product",
      header: "Product / SKU",
      cell: (row) => {
        const item = row.order_items?.[0];
        if (!item) return "\u2014";
        return (
          <div className="flex flex-col">
            <span className="text-sm">{item.product_name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{item.sku}</span>
          </div>
        );
      },
    },
    {
      key: "qty",
      header: "Qty",
      cell: (row) => row.order_items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
      className: "text-right",
    },
    { key: "amount", header: "Amount", cell: (row) => formatPeso(row.total_amount), className: "text-right" },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = orderStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "rewards",
      header: "Rewards",
      cell: (row) => {
        // The authoritative status, derived from the reward ledgers, so this column
        // cannot disagree with the approval screen or with a missing legacy flag.
        const derived = rewardStatus[row.id];
        if (derived === "partial") {
          return <StatusBadge label="Incomplete — retry" tone="warning" />;
        }
        const processed = derived === "complete" || derived === "historical" || row.rewards_processed;
        return (
          <span
            title={
              derived === "historical"
                ? "Rewards were fully credited when this order was processed; the reward matrix has changed since."
                : processed
                  ? "Every reward this order owes has been credited."
                  : "No rewards have been credited for this order yet."
            }
          >
            <StatusBadge
              label={processed ? "Rewards processed" : "Rewards not processed"}
              tone={processed ? "success" : "warning"}
            />
          </span>
        );
      },
    },
    { key: "created", header: "Created", cell: (row) => formatDate(row.created_at) },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every purchase record in the system with its payment and reward state."
        actions={<ExportButton dataset="orders" filters={{ status: status === "all" ? null : status }} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders Listed" value={formatPoints(orders.length)} icon={Package} accent="primary" loading={loading} />
        <StatCard label="Awaiting Verification" value={String(counts.awaiting)} accent="gold" loading={loading} />
        <StatCard label="Confirmed" value={String(counts.confirmed)} accent="success" loading={loading} />
        <StatCard
          label="Rewards Not Processed"
          value={String(counts.rewardsPending)}
          hint="Confirmed orders needing a retry"
          accent="platinum"
          loading={loading}
        />
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search order number, buyer, SKU or product" />
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "pending_payment", label: "Pending Payment" },
            { value: "proof_submitted", label: "Proof Submitted" },
            { value: "under_review", label: "Under Review" },
            { value: "confirmed", label: "Confirmed" },
            { value: "rejected", label: "Rejected" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Switch id="orders-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
          <Label htmlFor="orders-include-test" className="cursor-pointer text-xs">
            Include test data
          </Label>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={(row) => navigate(`/admin/orders/${row.id}`)}
        empty={<EmptyState icon={Package} title="No orders found" description="Adjust the filters to widen the search." />}
      />
    </>
  );
}
