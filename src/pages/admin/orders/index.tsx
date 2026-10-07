import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
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
      if (active) {
        setOrders((data ?? []) as unknown as OrderRow[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [includeTest]);

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
      cell: (row) => (
        <StatusBadge
          label={row.rewards_processed ? "Processed" : "Not processed"}
          tone={row.rewards_processed ? "success" : "warning"}
        />
      ),
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
