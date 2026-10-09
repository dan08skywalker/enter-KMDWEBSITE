import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import type { LoyaltyLedgerRow, PointLedgerRow, WalletLedgerRow } from "@/lib/kmd/types";

export interface MemberLedger {
  loading: boolean;
  /** Net lifetime unilevel after posted administrator adjustments (server-derived). */
  lifetimeUnilevelNet: number;
  /** Net lifetime loyalty credits after posted administrator debit adjustments. */
  lifetimeLoyaltyCredits: number;
  pointRows: PointLedgerRow[];
  loyaltyRows: LoyaltyLedgerRow[];
  walletRows: WalletLedgerRow[];
  /** credits - posted debits - held debits, exactly as the server calculates it */
  availablePoints: number;
  postedPoints: number;
  heldPoints: number;
  lifetimePoints: number;
  loyaltyCredits: number;
  shoppingWallet: number;
  reload: () => Promise<void>;
}

/**
 * Balances are derived from this member's own ledger rows rather than trusted from
 * a column, so the figure shown always agrees with the ledger. Realtime keeps it
 * current the moment the reward engine posts a new entry.
 */
export function useMemberLedger(): MemberLedger {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pointRows, setPointRows] = useState<PointLedgerRow[]>([]);
  const [loyaltyRows, setLoyaltyRows] = useState<LoyaltyLedgerRow[]>([]);
  const [walletRows, setWalletRows] = useState<WalletLedgerRow[]>([]);
  const [lifetimeUnilevelNet, setLifetimeUnilevelNet] = useState(0);
  const [lifetimeLoyaltyCredits, setLifetimeLoyaltyCredits] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setPointRows([]);
      setLoyaltyRows([]);
      setWalletRows([]);
      setLifetimeUnilevelNet(0);
      setLifetimeLoyaltyCredits(0);
      setLoading(false);
      return;
    }

    const [points, loyalty, wallet, summary] = await Promise.all([
      supabase
        .from("point_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("loyalty_credit_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("shopping_wallet_ledger")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      // Lifetime totals are net of posted administrator adjustments, so they are
      // read from the ledger on the server rather than summed from this page's
      // window of rows.
      supabase.rpc("kmd_member_points_summary", { p_member: user.id }),
    ]);

    if (points.error) console.error("Could not load point ledger:", points.error.message);
    if (loyalty.error) console.error("Could not load loyalty ledger:", loyalty.error.message);
    if (wallet.error) console.error("Could not load wallet ledger:", wallet.error.message);

    const lifetime = (summary.data ?? null) as Record<string, unknown> | null;
    if (summary.error) console.error("Could not read the lifetime totals:", summary.error.message);
    setLifetimeUnilevelNet(toNumber(lifetime?.lifetimeUnilevel));
    setLifetimeLoyaltyCredits(toNumber(lifetime?.lifetimeLoyaltyCredits));

    setPointRows((points.data ?? []) as unknown as PointLedgerRow[]);
    setLoyaltyRows((loyalty.data ?? []) as unknown as LoyaltyLedgerRow[]);
    setWalletRows((wallet.data ?? []) as unknown as WalletLedgerRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh(
    ["point_ledger", "loyalty_credit_ledger"],
    () => void load(),
    user ? `beneficiary_id=eq.${user.id}` : undefined,
  );
  useRealtimeRefresh(
    ["shopping_wallet_ledger"],
    () => void load(),
    user ? `member_id=eq.${user.id}` : undefined,
  );

  const derived = useMemo(() => {
    let credits = 0;
    let debits = 0;
    let held = 0;
    let unilevelCredits = 0;

    for (const row of pointRows) {
      const amount = Number(row.total_points ?? 0);
      if (row.direction === "CREDIT" && row.status === "posted") {
        credits += amount;
        if (row.transaction_type === "UNILEVEL_BONUS") unilevelCredits += amount;
      } else if (row.direction === "DEBIT" && row.status === "posted") {
        debits += amount;
      } else if (row.direction === "DEBIT" && row.status === "pending") {
        held += amount;
      }
    }

    let loyaltyCredits = 0;
    for (const row of loyaltyRows) {
      const amount = Number(row.credit_amount ?? 0);
      if (row.status !== "posted") continue;
      loyaltyCredits += row.direction === "CREDIT" ? amount : -amount;
    }

    let shoppingWallet = 0;
    for (const row of walletRows) {
      const amount = Number(row.amount ?? 0);
      if (row.status !== "posted") continue;
      shoppingWallet += row.direction === "CREDIT" ? amount : -amount;
    }

    return {
      availablePoints: credits - debits - held,
      postedPoints: credits - debits,
      heldPoints: held,
      lifetimePoints: unilevelCredits,
      loyaltyCredits,
      shoppingWallet,
    };
  }, [pointRows, loyaltyRows, walletRows]);

  return {
    loading,
    pointRows,
    loyaltyRows,
    walletRows,
    lifetimeUnilevelNet,
    lifetimeLoyaltyCredits,
    ...derived,
    reload: load,
  };
}
