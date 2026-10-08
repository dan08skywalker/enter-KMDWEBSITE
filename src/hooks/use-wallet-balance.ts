import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { toNumber } from "@/lib/kmd/format";

export interface WalletBalance {
  /** Shopping Wallet balance derived from the ledger by the server. */
  balance: number;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * The signed-in member's own Shopping Wallet balance.
 *
 * The figure comes from the server function, which reads the member id from the
 * session and derives the balance from the wallet ledger — the same source the
 * payment uses, so a checkout decision and the charge can never disagree. Realtime
 * keeps it current: a conversion made in another tab lands here immediately.
 */
export function useWalletBalance(): WalletBalance {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("kmd_my_wallet_balance");

    if (error) {
      console.error("Could not read the Shopping Wallet balance:", error.message);
      setLoading(false);
      return;
    }

    setBalance(toNumber((data as Record<string, unknown> | null)?.shoppingWallet, 0));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A conversion, a wallet payment or a refund all write to this ledger.
  useRealtimeRefresh(
    ["shopping_wallet_ledger"],
    () => void reload(),
    user ? `member_id=eq.${user.id}` : undefined,
  );

  // Coming back from the conversion page should show the balance that was added.
  useEffect(() => {
    const onFocus = () => void reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  return { balance, loading, reload };
}
