import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Eye, Filter, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { EngineResultPanel } from "@/components/kmd/engine-result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatPeso, toNumber } from "@/lib/kmd/format";
import { paymentMethod } from "@/lib/kmd/labels";
import type {
  EngineRunResult,
  Order,
  OrderItem,
  PaymentProof,
  Profile,
} from "@/lib/kmd/types";
import { approvalBucket, approvalDescriptor, buyerLabel, searchHaystack, type ApprovalRow } from "./approval";
import { PaymentDetailsDialog } from "./payment-details-dialog";

type Tab = "pending" | "approved" | "rejected" | "all";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

/** Statuses in which a submitted payment exists and is worth reviewing. */
const APPROVAL_STATUSES = ["proof_submitted", "under_review", "confirmed", "rejected"];
const PAGE_LIMIT = 300;

export default function AdminPaymentApprovals() {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [capped, setCapped] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [productId, setProductId] = useState("all");
  const [method, setMethod] = useState("all");
  const [includeTest, setIncludeTest] = useState(false);
  const [selected, setSelected] = useState<ApprovalRow | null>(null);
  const [engineResult, setEngineResult] = useState<EngineRunResult | null>(null);

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from("orders")
      .select("*")
      .in("status", APPROVAL_STATUSES)
      .order("created_at", { ascending: false })
      .limit(PAGE_LIMIT);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) {
      console.error("Could not load the payment approvals:", error.message);
      setLoading(false);
      return;
    }

    const orders = (data ?? []) as unknown as Order[];
    setCapped(orders.length === PAGE_LIMIT);

    const orderIds = orders.map((order) => order.id);
    const buyerIds = Array.from(
      new Set(orders.map((order) => order.buyer_profile_id).filter((id): id is string => Boolean(id))),
    );

    const [itemResult, proofResult, buyerResult, productResult, packageResult] = await Promise.all([
      orderIds.length
        ? supabase.from("order_items").select("*").in("order_id", orderIds).order("created_at")
        : Promise.resolve({ data: [], error: null }),
      orderIds.length
        ? supabase
            .from("payment_proofs")
            .select("*")
            .in("order_id", orderIds)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      buyerIds.length
        ? supabase.from("profiles").select("*").in("id", buyerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("products").select("id, sku, name, product_type, is_active"),
      supabase.from("membership_packages").select("id, package_code, name, product_id, is_active"),
    ]);

    for (const result of [itemResult, proofResult, buyerResult, productResult, packageResult]) {
      if ("error" in result && result.error) {
        console.error("Could not assemble the payment approvals:", result.error.message);
      }
    }

    const itemsByOrder = new Map<string, OrderItem[]>();
    for (const item of (itemResult.data ?? []) as unknown as OrderItem[]) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    // Only the most recent proof for an order is the one under review.
    const proofByOrder = new Map<string, PaymentProof>();
    for (const proof of (proofResult.data ?? []) as unknown as PaymentProof[]) {
      if (!proofByOrder.has(proof.order_id)) proofByOrder.set(proof.order_id, proof);
    }

    const buyerById = new Map<string, Profile>();
    for (const profile of (buyerResult.data ?? []) as unknown as Profile[]) {
      buyerById.set(profile.id, profile);
    }

    const membershipProductIds = new Map<string, string>();
    for (const pkg of (packageResult.data ?? []) as Array<{
      name: string;
      product_id: string;
      is_active: boolean;
    }>) {
      if (pkg.is_active) membershipProductIds.set(String(pkg.product_id), pkg.name);
    }

    setRows(
      orders.map((order) => {
        const items = itemsByOrder.get(order.id) ?? [];
        const membershipItem = items.find((item) => membershipProductIds.has(item.product_id));
        return {
          order,
          items,
          proof: proofByOrder.get(order.id) ?? null,
          buyer: order.buyer_profile_id ? (buyerById.get(order.buyer_profile_id) ?? null) : null,
          isMembership: Boolean(membershipItem),
          membershipLabel: membershipItem ? (membershipProductIds.get(membershipItem.product_id) ?? null) : null,
        };
      }),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["orders", "payment_proofs"], () => void load());

  const runAction = async (row: ApprovalRow, action: string, extra: Record<string, unknown>, message: string) => {
    const outcome = await invokeFunction<{ ok?: boolean; result?: EngineRunResult }>("admin-actions", {
      action,
      orderId: row.order.id,
      ...extra,
    });

    if (!outcome.ok) {
      toast.error("Action failed", { description: outcome.error });
      return { error: outcome.error ?? "Action failed" };
    }

    const result = outcome.data?.result ?? null;
    if (result && typeof result.status === "string") setEngineResult(result);

    if (result?.status === "FAILED" || result?.status === "NOT_QUALIFIED") {
      // A refusal still arrives inside a successful HTTP response, so it must not
      // be reported as though the payment went through.
      toast.error(message + " did not complete", {
        description: result.reasonText ?? "The backend refused the action.",
      });
    } else if (result?.status === "ALREADY_PROCESSED") {
      toast.info("This payment was already approved, so nothing was paid again");
    } else {
      toast.success(message);
    }
    setSelected(null);
    await load();
    return {};
  };

  const counts = useMemo(() => {
    const buckets = { pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) buckets[approvalBucket(row)] += 1;
    return { ...buckets, all: rows.length };
  }, [rows]);

  const pendingValue = useMemo(
    () =>
      rows
        .filter((row) => approvalBucket(row) === "pending")
        .reduce((sum, row) => sum + toNumber(row.proof?.amount ?? row.order.total_amount), 0),
    [rows],
  );

  const productOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const row of rows) {
      for (const item of row.items) options.set(item.product_id, item.product_name);
    }
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return rows.filter((row) => {
      if (tab !== "all" && approvalBucket(row) !== tab) return false;
      if (productId !== "all" && !row.items.some((item) => item.product_id === productId)) return false;
      if (method !== "all" && row.proof?.method !== method) return false;

      if (from !== null || to !== null) {
        const created = new Date(row.order.created_at).getTime();
        if (from !== null && created < from) return false;
        if (to !== null && created > to) return false;
      }

      if (needle && !searchHaystack(row).includes(needle)) return false;
      return true;
    });
  }, [rows, tab, productId, method, fromDate, toDate, search]);

  const columns: Column<ApprovalRow>[] = [
    {
      key: "order",
      header: "Order",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-semibold">{row.order.order_number}</span>
          <span className="text-[11px] text-muted-foreground">{formatDateTime(row.order.created_at)}</span>
        </div>
      ),
    },
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm">{buyerLabel(row)}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {row.buyer?.member_code ?? row.order.buyer_member_code ?? "guest"}
            {row.buyer?.username ? ` \u00b7 ${row.buyer.username}` : ""}
          </span>
        </div>
      ),
    },
    {
      key: "purchase",
      header: "Purchase",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-xs">
            {row.items[0]?.product_name ?? "\u2014"}
            {row.items.length > 1 ? ` +${row.items.length - 1} more` : ""}
          </span>
          {row.isMembership ? <StatusBadge label={row.membershipLabel ?? "Membership"} tone="gold" /> : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Declared",
      cell: (row) => (
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-sm font-semibold tabular-nums">
            {formatPeso(row.proof?.amount ?? row.order.total_amount)}
          </span>
          {row.proof && toNumber(row.proof.amount) !== toNumber(row.order.total_amount) ? (
            <span className="text-[11px] text-[hsl(var(--warning))]">
              order {formatPeso(row.order.total_amount)}
            </span>
          ) : null}
        </div>
      ),
      className: "text-right",
    },
    {
      key: "method",
      header: "Payment",
      cell: (row) => {
        const descriptor = row.proof ? paymentMethod(row.proof.method) : null;
        return (
          <div className="flex flex-col gap-1">
            {descriptor ? <StatusBadge label={descriptor.label} tone={descriptor.tone} /> : null}
            <span className="font-mono text-[11px] text-muted-foreground">
              {row.proof?.reference_number ?? "no reference"}
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Approval",
      cell: (row) => {
        const descriptor = approvalDescriptor(row);
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={descriptor.label} tone={descriptor.tone} />
            {row.order.is_test ? <StatusBadge label="Test" tone="platinum" /> : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View details
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Payment Approvals"
        description="Every submitted payment, its proof and its approval state. Approving runs the Unilevel and Loyalty engines once; it can never pay twice."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Approval" value={String(counts.pending)} icon={BadgeCheck} accent="gold" loading={loading} />
        <StatCard label="Approved" value={String(counts.approved)} icon={CheckCircle2} accent="success" loading={loading} />
        <StatCard label="Rejected" value={String(counts.rejected)} icon={XCircle} accent="primary" loading={loading} />
        <StatCard
          label="Value Awaiting Approval"
          value={formatPeso(pendingValue)}
          hint="Declared amount on pending submissions"
          accent="platinum"
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="h-auto flex-wrap">
            {TABS.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value} className="gap-2">
                {entry.label}
                <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
                  {counts[entry.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Switch id="approvals-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
          <Label htmlFor="approvals-include-test" className="cursor-pointer text-xs">
            Include test data
          </Label>
        </div>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search member name, member ID, username, order number or reference number"
        />
        <SelectFilter
          value={productId}
          onChange={setProductId}
          allLabel="All products & packages"
          options={productOptions}
          className="sm:w-[220px]"
        />
        <SelectFilter
          value={method}
          onChange={setMethod}
          allLabel="All payment methods"
          options={[
            { value: "gcash", label: "GCash" },
            { value: "maya", label: "Maya" },
            { value: "maya_bank", label: "Maya Bank Transfer" },
            { value: "bank_transfer", label: "Bank Transfer" },
            { value: "cash", label: "Cash" },
            { value: "other", label: "Other" },
          ]}
          className="sm:w-[200px]"
        />
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            aria-label="Submitted on or after"
            className="w-[150px]"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            aria-label="Submitted on or before"
            className="w-[150px]"
          />
        </div>
      </FilterBar>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {rows.length} submitted payment{rows.length === 1 ? "" : "s"}
          {capped ? ` (latest ${PAGE_LIMIT})` : ""}.
        </p>
        {(search || productId !== "all" || method !== "all" || fromDate || toDate) ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setProductId("all");
              setMethod("all");
              setFromDate("");
              setToDate("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.order.id}
        loading={loading}
        onRowClick={(row) => setSelected(row)}
        empty={
          <EmptyState
            icon={BadgeCheck}
            title={rows.length === 0 ? "No payments submitted yet" : "Nothing matches these filters"}
            description={
              rows.length === 0
                ? "A payment appears here the moment a buyer submits proof of payment."
                : "Adjust or clear the filters to see the other submissions."
            }
          />
        }
      />

      <PaymentDetailsDialog
        row={selected}
        canDecide={isSuperAdmin}
        onClose={() => setSelected(null)}
        onApprove={(row) => runAction(row, "confirm_payment", { reason: "Payment approved" }, "Payment approved")}
        onReject={(row) => runAction(row, "reject_payment", { reason: "Payment rejected" }, "Payment rejected")}
        onMarkUnderReview={(row) =>
          runAction(row, "set_order_status", { status: "under_review", reason: "Marked under review" }, "Marked under review")
        }
      />

      <Dialog open={engineResult !== null} onOpenChange={(open) => !open && setEngineResult(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reward engine result</DialogTitle>
            <DialogDescription>The literal response from the backend for this approval.</DialogDescription>
          </DialogHeader>
          {engineResult ? <EngineResultPanel result={engineResult} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
