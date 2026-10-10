import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { LoyaltyCard, type LoyaltyTier } from "@/components/kmd/loyalty-card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/kmd/format";
import { packageTier } from "@/lib/kmd/labels";

interface MemberLoyaltyCardRow {
  id: string;
  tier: LoyaltyTier;
  tierLabel: string;
  productName: string;
  sku: string;
  activationDate: string | null;
  status: string;
}

export default function MemberLoyaltyCards() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MemberLoyaltyCardRow[]>([]);
  // Read fresh from the profile so a saved member-ID change reaches the card.
  const [member, setMember] = useState<{ memberCode: string; fullName: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profileResult, orderResult] = await Promise.all([
      supabase.from("profiles").select("member_code, full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("orders")
        .select("id, created_at, status, order_items(sku, product_id, product_name)")
        .eq("buyer_profile_id", user.id)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false }),
    ]);

    if (profileResult.error) {
      console.error("Could not load the member record:", profileResult.error.message);
    }
    if (orderResult.error) {
      console.error("Could not load confirmed orders:", orderResult.error.message);
    }

    const profileRow = profileResult.data as
      | { member_code: string; full_name: string | null }
      | null;
    if (profileRow) {
      setMember({ memberCode: profileRow.member_code, fullName: profileRow.full_name });
    }

    const rows = (orderResult.data ?? []) as unknown as Array<{
      id: string;
      created_at: string;
      status: string;
      order_items: Array<{ sku: string; product_id: string; product_name: string }> | null;
    }>;

    const productIds = Array.from(
      new Set(rows.flatMap((order) => (order.order_items ?? []).map((item) => item.product_id))),
    );

    let packages: Array<{ product_id: string; name: string; tier: LoyaltyTier }> = [];
    if (productIds.length > 0) {
      const { data: packageRows, error: packageError } = await supabase
        .from("membership_packages")
        .select("product_id, name, tier")
        .in("product_id", productIds);
      if (packageError) {
        console.error("Could not load membership packages:", packageError.message);
      } else {
        packages = (packageRows ?? []) as unknown as typeof packages;
      }
    }

    const built: MemberLoyaltyCardRow[] = [];
    for (const order of rows) {
      for (const item of order.order_items ?? []) {
        const pkg = packages.find((entry) => entry.product_id === item.product_id);
        if (!pkg) continue;
        built.push({
          id: `${order.id}-${item.sku}`,
          tier: pkg.tier,
          tierLabel: packageTier(pkg.tier).label,
          productName: item.product_name,
          sku: item.sku,
          activationDate: order.created_at,
          status: "Active",
        });
      }
    }

    setCards(built);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh(["profiles"], () => void load(), user ? `id=eq.${user.id}` : undefined);

  // The card number is the cardholder's KMD member ID, taken from their profile.
  const memberCode = member?.memberCode ?? profile?.member_code ?? "";
  const memberName = member?.fullName ?? profile?.full_name ?? "Member";

  const currentTier = useMemo(() => {
    const latest = cards[0];
    return latest ? latest.tier : null;
  }, [cards]);

  const columns: Column<MemberLoyaltyCardRow>[] = [
    { key: "type", header: "Card Type", cell: (row) => <StatusBadge label={`${row.tierLabel} Loyalty Card`} tone={row.tier === "gold" ? "gold" : row.tier === "platinum" ? "platinum" : "info"} /> },
    { key: "name", header: "Member Name", cell: () => memberName },
    { key: "number", header: "Card Number", cell: () => <span className="font-mono text-xs">{memberCode}</span> },
    { key: "activation", header: "Activation Date", cell: (row) => formatDate(row.activationDate) },
    { key: "status", header: "Status", cell: (row) => <StatusBadge label={row.status} tone="success" /> },
  ];

  return (
    <>
      <PageHeader
        title="My Loyalty Card"
        description="Cards are issued automatically when a membership package purchase is confirmed."
      />

      {/*
        An upgrade keeps the same account, sponsor, team and history: it is bought
        through the existing membership packages page and activated when the payment
        is confirmed.
      */}
      <div className="kmd-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-semibold">Upgrade your membership</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Move to a higher tier from the membership packages page. Your account, sponsor, team and
            history stay exactly as they are.
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/packages">
            Upgrade
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="kmd-panel h-56 animate-pulse" />
          <div className="kmd-panel h-56 animate-pulse" />
        </div>
      ) : cards.length === 0 ? (
        <div className="kmd-panel">
          <EmptyState
            icon={CreditCard}
            title="No loyalty card yet"
            description="Once a membership package order is confirmed and payment verified, your card is issued and appears here."
            action={
              <Button asChild>
                <Link to="/app/orders">View my orders</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <LoyaltyCard
                key={card.id}
                tier={card.tier}
                memberName={memberName}
                memberCode={memberCode}
                activationDate={card.activationDate}
                status={card.status}
              />
            ))}
          </div>

          <DataTable
            columns={columns}
            rows={cards}
            rowKey={(row) => row.id}
            empty={<EmptyState icon={CreditCard} title="No cards" />}
          />

          {currentTier ? (
            <p className="text-xs text-muted-foreground">
              Your most recent card is a {packageTier(currentTier).label} Loyalty Card. Each confirmed
              package purchase issues its own card.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
