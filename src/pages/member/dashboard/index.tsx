import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Coins,
  Gem,
  Gift,
  ShieldAlert,
  ShoppingBag,
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
import { LoyaltyCard, type LoyaltyTier } from "@/components/kmd/loyalty-card";
import { packageTier } from "@/lib/kmd/labels";
import { LOYALTY_CARD_ASPECT } from "@/lib/kmd/constants";
import { Points } from "@/components/kmd/amount";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime, formatPeso, formatPoints, formatRelative, toNumber } from "@/lib/kmd/format";
import { ledgerStatus, transactionType } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow, PointLedgerRow, Redemption } from "@/lib/kmd/types";

/** Decorative leaf, drawn inline and kept at very low opacity behind content. */
function LeafAccent({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <path d="M6 94C6 48 36 10 96 6c4 54-26 88-90 88z" fill="hsl(146 62% 34%)" />
      <path d="M10 90C38 62 64 34 92 12" stroke="hsl(96 58% 45%)" strokeWidth="3" fill="none" />
    </svg>
  );
}

interface MembershipInfo {
  packageCode: string | null;
  packageName: string | null;
  tier: string | null;
  level1Cap: number | null;
  level1Capped: boolean;
  eligibleUpgrades: Array<{
    packageCode: string;
    packageName: string;
    tier: string;
    sku: string;
    productName: string;
    price: number;
    regularPrice: number | null;
    imageUrl: string | null;
  }>;
}

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
  const [cardTier, setCardTier] = useState<LoyaltyTier | null>(null);
  const [cardTierLoading, setCardTierLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);

  // The member's own package, their Level 1 cap and the higher tiers they may
  // upgrade to. All decided on the server from their own records.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase.rpc("kmd_my_membership");
      if (error) console.error("Could not read the membership details:", error.message);
      if (active) setMembership((data as unknown as MembershipInfo | null) ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const packageId = profile?.package_id;
    if (!packageId) {
      setCardTier(null);
      setCardTierLoading(false);
      return;
    }

    let active = true;
    setCardTierLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from("membership_packages")
        .select("tier")
        .eq("id", packageId)
        .maybeSingle();

      if (error) console.error("Could not load the loyalty card tier:", error.message);
      if (!active) return;
      setCardTier(((data?.tier as LoyaltyTier | undefined) ?? null));
      setCardTierLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [profile?.package_id]);

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

      {/*
        Loading, failure and a genuine zero are three different things: the cards below
        show skeletons while the figures are in flight, this notice appears only when a
        read actually failed, and a real zero then renders as a zero.
      */}
      {ledger.error ? (
        <div className="kmd-panel flex flex-wrap items-center justify-between gap-3 border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-destructive">Your balances could not be read</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing has been lost — this is a failed request, not a zero balance. The figures below
                will fill in once the connection recovers.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void ledger.reload()}>
            Try again
          </Button>
        </div>
      ) : null}

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---- the member's own card, with their shopping and redemption actions ---- */}
        <div className="space-y-4">
          <div className="kmd-panel relative overflow-hidden p-4 sm:p-5">
            <LeafAccent className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rotate-[24deg] opacity-[0.12]" />
            <div className="relative mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">My Loyalty Card</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/app/loyalty-cards">
                  Card details
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="relative flex justify-center sm:justify-start">
              {cardTierLoading ? (
                <Skeleton className={cn("w-full max-w-[420px] rounded-2xl", LOYALTY_CARD_ASPECT)} />
              ) : cardTier && profile ? (
                <LoyaltyCard
                  tier={cardTier}
                  memberName={profile.full_name}
                  memberCode={profile.member_code}
                  activationDate={profile.activation_date}
                  status={profile.account_status}
                />
              ) : (
                <div className="w-full rounded-2xl border border-dashed p-5 text-center sm:text-left">
                  <p className="text-sm font-semibold">No loyalty card yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A card is issued when your membership package is activated. Your balances and team
                    are unaffected.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link to="/packages">See membership packages</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              to="/shop"
              className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-primary">
                  Shop now
                </span>
                <span className="block text-[11px] text-muted-foreground">Browse products</span>
              </span>
            </Link>

            <Link
              to="/app/redeem"
              className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Gift className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-wide text-primary">
                  Redeem points
                </span>
                <span className="block text-[11px] text-muted-foreground">Use your points</span>
              </span>
            </Link>
          </div>

          {/* ---- membership tier, Level 1 cap and upgrades ---- */}
          <div className="kmd-panel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Membership</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {membership?.packageName ?? "No package yet"}
                  {membership?.tier ? ` · ${packageTier(membership.tier).label} tier` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {membership?.level1Capped
                    ? `Your Level 1 earning cap: ${formatPeso(membership.level1Cap)} per qualifying purchase`
                    : "No Level 1 cap — the reward matrix applies"}
                </p>
              </div>
              <Button asChild className="shrink-0">
                <Link to="/packages">
                  Upgrade
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            {(membership?.eligibleUpgrades?.length ?? 0) > 0 ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {membership?.eligibleUpgrades.map((entry) => (
                  <li key={entry.packageCode}>
                    <Link
                      to="/packages"
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-secondary">
                        {entry.imageUrl ? (
                          <img
                            src={entry.imageUrl}
                            alt=""
                            crossOrigin="anonymous"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">
                          {entry.packageName}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {packageTier(entry.tier).label} · {formatPeso(entry.price)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                You are on the highest membership tier.
              </p>
            )}
          </div>
        </div>

        {/* ---- the four primary balances, two by two ---- */}
        <div className="grid gap-4 sm:grid-cols-2">
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
          hint={`Lifetime ${formatPoints(ledger.lifetimeLoyaltyCredits)} · net of adjustments`}
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today", value: earnings.today },
          { label: "This Week", value: earnings.thisWeek },
          { label: "This Month", value: earnings.thisMonth },
          { label: "Lifetime Unilevel", value: ledger.lifetimeUnilevelNet, netOfAdjustments: true },
        ].map((item) => (
          <div key={item.label} className="kmd-panel p-4">
            <p className="kmd-label" title={item.netOfAdjustments
              ? "Net of posted administrator debit adjustments"
              : undefined}>
              {item.label}
            </p>
            {ledger.loading ? (
              <Skeleton className="mt-2 h-6 w-20" />
            ) : (
              <>
                <p className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums">{formatPoints(item.value)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatPeso(item.value, rate)}
                  </span>
                </p>
                {item.netOfAdjustments ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Net of posted administrator adjustments
                  </p>
                ) : null}
              </>
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
                description="Level 1 to Level 10 bonuses are credited automatically once a purchase is qualified."
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
