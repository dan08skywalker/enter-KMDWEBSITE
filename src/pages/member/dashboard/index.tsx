import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Coins,
  Gem,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { usePointRate } from "@/hooks/use-point-rate";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Points } from "@/components/kmd/amount";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatPeso, formatPoints, formatRelative, toNumber } from "@/lib/kmd/format";
import { ledgerStatus, transactionType } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow, PointLedgerRow, Redemption } from "@/lib/kmd/types";

function startOf(unit: "day" | "week" | "month"): Date {
  const now = new Date();
  if (unit === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (unit === "week") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function MemberDashboard() {
  const { profile } = useAuth();
  const rate = usePointRate();
  const ledger = useMemberLedger();
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("redemptions")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) {
        console.error("Could not load pending redemptions:", error.message);
        return;
      }
      if (active) setPendingRedemptions((data ?? []) as unknown as Redemption[]);
    })();
    return () => {
      active = false;
    };
  }, [ledger.pointRows.length]);

  const earnings = useMemo(() => {
    const day = startOf("day").getTime();
    const week = startOf("week").getTime();
    const month = startOf("month").getTime();
    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    for (const row of ledger.pointRows) {
      if (row.transaction_type !== "UNILEVEL_BONUS" || row.direction !== "CREDIT" || row.status !== "posted") {
        continue;
      }
      const at = new Date(row.created_at).getTime();
      const amount = toNumber(row.total_points);
      if (at >= day) today += amount;
      if (at >= week) thisWeek += amount;
      if (at >= month) thisMonth += amount;
    }

    return { today, thisWeek, thisMonth };
  }, [ledger.pointRows]);

  const recentTransactions = ledger.pointRows.slice(0, 8);
  const recentBonuses = ledger.pointRows
    .filter((row) => row.transaction_type === "UNILEVEL_BONUS")
    .slice(0, 5);
  const recentLoyalty = ledger.loyaltyRows.slice(0, 5);

  /** Team activity is read from this member's own ledger: the purchases that paid them. */
  const teamActivity = useMemo(() => {
    const seen = new Map<string, { buyer: string; when: string; points: number; count: number }>();
    for (const row of ledger.pointRows) {
      if (row.transaction_type !== "UNILEVEL_BONUS" || row.direction !== "CREDIT") continue;
      const key = `${row.buyer_member_code ?? "unknown"}|${row.order_id ?? row.transaction_id}`;
      const existing = seen.get(key);
      if (existing) {
        existing.points += toNumber(row.total_points);
        existing.count += 1;
      } else {
        seen.set(key, {
          buyer: row.buyer_member_code ?? "Unknown member",
          when: row.created_at,
          points: toNumber(row.total_points),
          count: 1,
        });
      }
    }
    return Array.from(seen.values()).slice(0, 5);
  }, [ledger.pointRows]);

  const transactionColumns: Column<PointLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "id",
      header: "Transaction",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
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

  const loyaltyColumns: Column<LoyaltyLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "id",
      header: "Transaction",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    { key: "buyer", header: "Buyer", cell: (row) => row.buyer_member_code ?? "\u2014" },
    { key: "product", header: "Product", cell: (row) => row.product_name ?? "\u2014" },
    {
      key: "amount",
      header: "Credit",
      cell: (row) => <Points value={row.credit_amount} showSign direction={row.direction} />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.first_name ?? "member"}`}
        description="Your unilevel earnings, loyalty credits and team activity, posted straight from the reward ledger."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/redeem">
              Redeem points
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {profile && (profile.account_status === "suspended" || profile.account_status === "inactive") ? (
        <div className="kmd-panel border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                Your account is {profile.account_status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Placing orders, requesting payouts and converting points are paused, and bonuses are not
                accruing to your account while it is restricted. Your balances, ledger entries and team
                are unchanged, and an administrator can lift this. Please contact an administrator for
                the reason and any next steps.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {pendingRedemptions.length > 0 ? (
        <div className="kmd-panel flex flex-col gap-2 border-warning/40 bg-warning/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 text-[hsl(var(--warning))]" />
            <div>
              <p className="text-sm font-semibold">
                {pendingRedemptions.length} redemption
                {pendingRedemptions.length > 1 ? "s" : ""} awaiting approval
              </p>
              <p className="text-xs text-muted-foreground">
                The requested points are held against your available balance until an administrator
                approves or rejects the request.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/app/redeem">View requests</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available Unilevel Points"
          value={formatPoints(ledger.availablePoints)}
          hint={`${formatPeso(ledger.availablePoints, rate)} redeemable`}
          icon={Coins}
          accent="gold"
          loading={ledger.loading}
        />
        <StatCard
          label="Loyalty Credits"
          value={formatPoints(ledger.loyaltyCredits)}
          hint="Separate loyalty ledger"
          icon={Sparkles}
          accent="primary"
          loading={ledger.loading}
        />
        <StatCard
          label="Shopping Wallet"
          value={formatPoints(ledger.shoppingWallet)}
          hint="Converted from points"
          icon={Wallet}
          accent="platinum"
          loading={ledger.loading}
        />
        <StatCard
          label="Total Lifetime Earnings"
          value={formatPoints(profile?.total_lifetime_earnings)}
          hint={formatPeso(profile?.total_lifetime_earnings, rate)}
          icon={Gem}
          accent="success"
          loading={ledger.loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today", value: earnings.today },
          { label: "This Week", value: earnings.thisWeek },
          { label: "This Month", value: earnings.thisMonth },
          { label: "Lifetime Unilevel", value: ledger.lifetimePoints },
        ].map((item) => (
          <div key={item.label} className="kmd-panel p-4">
            <p className="kmd-label">{item.label}</p>
            {ledger.loading ? (
              <Skeleton className="mt-2 h-6 w-20" />
            ) : (
              <p className="mt-1.5 flex items-baseline gap-2">
                <span className="text-lg font-bold tabular-nums">{formatPoints(item.value)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatPeso(item.value, rate)}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>

      {ledger.heldPoints > 0 ? (
        <p className="text-xs text-muted-foreground">
          {formatPoints(ledger.heldPoints)} points are currently held against pending redemption
          requests and are excluded from your available balance.
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent Transactions</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/point-transactions">View all</Link>
          </Button>
        </div>
        <DataTable
          columns={transactionColumns}
          rows={recentTransactions}
          rowKey={(row) => row.id}
          loading={ledger.loading}
          empty={
            <EmptyState
              icon={Coins}
              title="No point transactions yet"
              description="When someone in your team makes a qualified purchase, your unilevel bonus appears here automatically."
            />
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Recent Unilevel Bonuses</h2>
          <div className="kmd-panel divide-y">
            {ledger.loading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : recentBonuses.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No bonuses yet"
                description="Level 1 to Level 5 bonuses are credited automatically once a purchase is qualified."
              />
            ) : (
              recentBonuses.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Level {row.unilevel_level ?? "\u2014"} &middot; {row.product_name ?? row.sku ?? "Purchase"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Buyer {row.buyer_member_code ?? "\u2014"} &middot;{" "}
                      {formatPoints(row.points_per_unit)} x {row.quantity ?? 0} ={" "}
                      {formatPoints(row.total_points)} pts &middot; {formatRelative(row.created_at)}
                    </p>
                  </div>
                  <Points value={row.total_points} showSign direction={row.direction} />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recent Loyalty Credits</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/loyalty-credits">View all</Link>
            </Button>
          </div>
          <DataTable
            columns={loyaltyColumns}
            rows={recentLoyalty}
            rowKey={(row) => row.id}
            loading={ledger.loading}
            empty={
              <EmptyState
                icon={Sparkles}
                title="No loyalty credits yet"
                description="Loyalty Credits are tracked separately from Unilevel Points and post to their own ledger."
              />
            }
          />
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent Team Activity</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/team">
              <Users className="h-4 w-4" />
              My team
            </Link>
          </Button>
        </div>
        <div className="kmd-panel divide-y">
          {ledger.loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : teamActivity.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No team purchases yet"
              description="Invite members with your referral link — their qualified purchases drive your commissions."
            />
          ) : (
            teamActivity.map((entry) => (
              <div key={`${entry.buyer}-${entry.when}`} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium">{entry.buyer}</p>
                  <p className="text-xs text-muted-foreground">
                    Qualified purchase &middot; {formatRelative(entry.when)} &middot; {entry.count} ledger
                    {entry.count > 1 ? " entries" : " entry"}
                  </p>
                </div>
                <Points value={entry.points} showSign direction="CREDIT" />
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
