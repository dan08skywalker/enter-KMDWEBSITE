import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Coins,
  Gift,
  Package,
  ShieldCheck,
  Sparkles,
  Users,
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatPoints, formatRelative, toNumber } from "@/lib/kmd/format";
import { auditAction, orderStatus } from "@/lib/kmd/labels";
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
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [needsAttention, setNeedsAttention] = useState<Order[]>([]);
  const [audit, setAudit] = useState<AuditLogRow[]>([]);
  const [levelRows, setLevelRows] = useState<PointLedgerRow[]>([]);

  const load = async () => {
    setLoading(true);

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
    });

    setNeedsAttention((attention.data ?? []) as unknown as Order[]);
    setAudit((auditRows.data ?? []) as unknown as AuditLogRow[]);
    setLevelRows((ledger.data ?? []) as unknown as PointLedgerRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  useRealtimeRefresh(["orders", "point_ledger", "redemptions", "profiles"], () => void load());

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
