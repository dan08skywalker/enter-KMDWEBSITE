import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Coins,
  Gift,
  Package,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { StatusBadge } from "@/components/kmd/status-badge";
import { EmptyState } from "@/components/kmd/empty-state";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatPeso, formatPoints, formatRelative, toNumber } from "@/lib/kmd/format";
import { auditAction, orderStatus, paymentMethod, paymentStatus } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { AuditLogRow, Order, PointLedgerRow } from "@/lib/kmd/types";

interface Counts {
  members: number;
  activeMembers: number;
  retailers: number;
  orders: number;
  awaitingVerification: number;
  pendingRedemptions: number;
  pointsAwarded: number;
  loyaltyAwarded: number;
  walletBalance: number;
  pendingPayments: number;
  approvedPayments: number;
  rejectedPayments: number;
  todayApprovedPayments: number;
  pendingActivations: number;
}

const EMPTY_COUNTS: Counts = {
  members: 0,
  activeMembers: 0,
  retailers: 0,
  orders: 0,
  awaitingVerification: 0,
  pendingRedemptions: 0,
  pointsAwarded: 0,
  loyaltyAwarded: 0,
  walletBalance: 0,
  pendingPayments: 0,
  approvedPayments: 0,
  rejectedPayments: 0,
  todayApprovedPayments: 0,
  pendingActivations: 0,
};

/** One row of the recent-transactions ledger shown to the administrator. */
interface RecentPayment {
  id: string;
  orderNumber: string;
  memberCode: string | null;
  amount: number;
  method: string;
  status: string;
  submittedAt: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [needsAttention, setNeedsAttention] = useState<Order[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [levelRows, setLevelRows] = useState<PointLedgerRow[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);

  const load = async () => {
    setLoading(true);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      members,
      activeMembers,
      retailers,
      orders,
      awaiting,
      redemptions,
      points,
      loyalty,
      profiles,
      attention,
      auditRows,
      ledger,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      todayApproved,
      pendingActivations,
      recentProofs,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "active"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "retailer"),
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .in("status", ["proof_submitted", "under_review"]),
      supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("point_ledger")
        .select("total_points")
        .eq("transaction_type", "UNILEVEL_BONUS")
        .eq("status", "posted"),
      supabase
        .from("loyalty_credit_ledger")
        .select("credit_amount")
        .eq("status", "posted"),
      supabase.from("profiles").select("shopping_wallet_balance"),
      supabase
        .from("orders")
        .select("*")
        .eq("status", "confirmed")
        .eq("rewards_processed", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("point_ledger")
        .select("*")
        .eq("transaction_type", "UNILEVEL_BONUS")
        .eq("status", "posted")
        .limit(2000),
      supabase
        .from("payment_proofs")
        .select("*", { count: "exact", head: true })
        .in("status", ["submitted", "under_review"]),
      supabase.from("payment_proofs").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
      supabase.from("payment_proofs").select("*", { count: "exact", head: true }).eq("status", "rejected"),
      supabase
        .from("payment_proofs")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gte("reviewed_at", startOfDay.toISOString()),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_status", "pending"),
      supabase
        .from("payment_proofs")
        .select("id, order_id, member_code, method, amount, status, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(6),
    ]);

    const queryError =
      members.error ?? activeMembers.error ?? retailers.error ?? orders.error ?? points.error;
    if (queryError) console.error("Admin dashboard query failed:", queryError.message);

    setCounts({
      members: members.count ?? 0,
      activeMembers: activeMembers.count ?? 0,
      retailers: retailers.count ?? 0,
      orders: orders.count ?? 0,
      awaitingVerification: awaiting.count ?? 0,
      pendingRedemptions: redemptions.count ?? 0,
      pointsAwarded: ((points.data ?? []) as Array<{ total_points: number }>).reduce(
        (sum, row) => sum + toNumber(row.total_points),
        0,
      ),
      loyaltyAwarded: ((loyalty.data ?? []) as Array<{ credit_amount: number }>).reduce(
        (sum, row) => sum + toNumber(row.credit_amount),
        0,
      ),
      walletBalance: ((profiles.data ?? []) as Array<{ shopping_wallet_balance: number }>).reduce(
        (sum, row) => sum + toNumber(row.shopping_wallet_balance),
        0,
      ),
      pendingPayments: pendingPayments.count ?? 0,
      approvedPayments: approvedPayments.count ?? 0,
      rejectedPayments: rejectedPayments.count ?? 0,
      todayApprovedPayments: todayApproved.count ?? 0,
      pendingActivations: pendingActivations.count ?? 0,
    });

    const proofRows = (recentProofs.data ?? []) as Array<{
      id: string;
      order_id: string;
      member_code: string | null;
      method: string;
      amount: number;
      status: string;
      submitted_at: string;
    }>;
    const proofOrderIds = Array.from(new Set(proofRows.map((proof) => proof.order_id)));
    const orderNumbers = new Map<string, string>();
    if (proofOrderIds.length > 0) {
      const { data: proofOrders } = await supabase
        .from("orders")
        .select("id, order_number")
        .in("id", proofOrderIds);
      for (const order of (proofOrders ?? []) as Array<{ id: string; order_number: string }>) {
        orderNumbers.set(order.id, order.order_number);
      }
    }
    setRecentPayments(
      proofRows.map((proof) => ({
        id: proof.id,
        orderNumber: orderNumbers.get(proof.order_id) ?? "\u2014",
        memberCode: proof.member_code,
        amount: toNumber(proof.amount),
        method: proof.method,
        status: proof.status,
        submittedAt: proof.submitted_at,
      })),
    );

    setNeedsAttention((attention.data ?? []) as unknown as Order[]);
    setAudit((auditRows.data ?? []) as unknown as AuditLogRow[]);
    setLevelRows((ledger.data ?? []) as unknown as PointLedgerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useRealtimeRefresh(["orders", "point_ledger", "redemptions", "profiles", "payment_proofs"], () => void load());

  const chartData = useMemo(
    () =>
      UNILEVEL_LEVELS.map((level) => ({
        level: `L${level}`,
        points: levelRows
          .filter((row) => row.unilevel_level === level)
          .reduce((sum, row) => sum + toNumber(row.total_points), 0),
      })),
    [levelRows],
  );

  const chartColors = [
    "hsl(var(--gold))",
    "hsl(var(--primary))",
    "hsl(var(--platinum))",
    "hsl(var(--success))",
    "hsl(var(--warning))",
  ];

  const paymentColumns: Column<RecentPayment>[] = [
    {
      key: "order",
      header: "Order",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.orderNumber}</span>,
    },
    {
      key: "member",
      header: "Member",
      cell: (row) => <span className="font-mono text-xs text-muted-foreground">{row.memberCode ?? "guest"}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <span className="tabular-nums">{formatPeso(row.amount)}</span>,
      className: "text-right",
    },
    {
      key: "method",
      header: "Method",
      cell: (row) => {
        const descriptor = paymentMethod(row.method);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "status",
      header: "Approval",
      cell: (row) => {
        const descriptor = paymentStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "submitted", header: "Submitted", cell: (row) => formatRelative(row.submittedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Administrator Dashboard"
        description="System-wide totals, the payment verification queue and recent audited activity."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/diagnostics">
              <Activity className="h-4 w-4" />
              Reward diagnostics
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Members" value={String(counts.members)} icon={Users} accent="primary" loading={loading} />
        <StatCard label="Active Members" value={String(counts.activeMembers)} hint="Qualified to earn" accent="success" loading={loading} />
        <StatCard label="Retailers" value={String(counts.retailers)} accent="platinum" loading={loading} />
        <StatCard label="Total Orders" value={String(counts.orders)} icon={Package} accent="primary" loading={loading} />
        <StatCard label="Awaiting Verification" value={String(counts.awaitingVerification)} hint="Proof submitted or under review" icon={BadgeCheck} accent="gold" loading={loading} />
        <StatCard label="Pending Redemptions" value={String(counts.pendingRedemptions)} icon={Gift} accent="primary" loading={loading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unilevel Points Awarded" value={formatPoints(counts.pointsAwarded)} icon={Coins} accent="gold" loading={loading} />
        <StatCard label="Loyalty Credits Awarded" value={formatPoints(counts.loyaltyAwarded)} icon={Sparkles} accent="primary" loading={loading} />
        <StatCard label="Shopping Wallet Held" value={formatPoints(counts.walletBalance)} hint="Across all members" accent="platinum" loading={loading} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Payments</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Pending Payments"
            value={String(counts.pendingPayments)}
            hint="Submitted proofs awaiting approval"
            icon={BadgeCheck}
            accent="gold"
            loading={loading}
          />
          <StatCard
            label="Approved Payments"
            value={String(counts.approvedPayments)}
            hint="Confirmed and paid out once"
            icon={CheckCircle2}
            accent="success"
            loading={loading}
          />
          <StatCard
            label="Rejected Payments"
            value={String(counts.rejectedPayments)}
            hint="Closed without rewards"
            icon={XCircle}
            accent="primary"
            loading={loading}
          />
          <StatCard
            label="Approved Today"
            value={String(counts.todayApprovedPayments)}
            hint="Approved since midnight"
            icon={CalendarClock}
            accent="platinum"
            loading={loading}
          />
          <StatCard
            label="Pending Membership Activations"
            value={String(counts.pendingActivations)}
            hint="Registered members not yet activated"
            icon={UserRoundCheck}
            accent="gold"
            loading={loading}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Unilevel points awarded per level</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Levels 3 to 5 only pay once their values are configured in Reward Configuration.
          </p>
          <div className="mt-4 h-[260px] w-full">
            {loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="level" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" width={64} />
                  <Tooltip
                    formatter={(value: number) => [`${formatPoints(value)} points`, "Awarded"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={entry.level} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="kmd-panel">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
            <h2 className="text-sm font-semibold">Needs attention</h2>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : needsAttention.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing outstanding"
              description="No confirmed order is missing its reward processing."
            />
          ) : (
            <ul className="divide-y">
              {needsAttention.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold">{order.order_number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.buyer_member_code} &middot; {formatRelative(order.created_at)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/admin/orders/${order.id}`}>Inspect</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {counts.awaitingVerification > 0 ? (
            <div className="border-t px-5 py-3">
              <Button asChild size="sm" className="w-full">
                <Link to="/admin/payment-verification">
                  {counts.awaitingVerification} order{counts.awaitingVerification > 1 ? "s" : ""} awaiting
                  verification
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="kmd-panel">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Recent audit activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every sensitive action is recorded. History is never edited or deleted.
          </p>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        ) : audit.length === 0 ? (
          <EmptyState icon={Activity} title="No activity recorded yet" />
        ) : (
          <ul className="divide-y">
            {audit.map((row) => {
              const descriptor = auditAction(row.action);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={descriptor.label} tone={descriptor.tone} />
                    <span className="text-xs text-muted-foreground">
                      {row.actor_member_code ?? row.actor_username ?? "System"}
                      {row.target_member_code ? ` \u2192 ${row.target_member_code}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="kmd-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Recent transactions</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The latest payment submissions and where each one stands.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/payment-verification">
              <Receipt className="h-3.5 w-3.5" />
              Open Payment Approvals
            </Link>
          </Button>
        </div>
        <DataTable
          columns={paymentColumns}
          rows={recentPayments}
          rowKey={(row) => row.id}
          loading={loading}
          empty={
            <EmptyState
              icon={Receipt}
              title="No payment submissions yet"
              description="Every submitted proof of payment appears here as soon as a buyer sends it."
            />
          }
        />
      </div>

      <div className="kmd-panel p-5">
        <h2 className="text-sm font-semibold">Order status mix</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["pending_payment", "proof_submitted", "under_review", "confirmed", "rejected", "cancelled"] as const).map(
            (value) => {
              const descriptor = orderStatus(value);
              return <StatusBadge key={value} label={descriptor.label} tone={descriptor.tone} />;
            },
          )}
        </div>
      </div>
    </>
  );
}
