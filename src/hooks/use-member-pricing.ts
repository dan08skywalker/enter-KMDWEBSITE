import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { toNumber } from "@/lib/kmd/format";

export type MemberPriceCategory = "trial" | "classic" | "gold" | "platinum" | "stockist";

export interface MemberPriceEntry {
  productId: string;
  sku: string;
  name: string;
  /** What this buyer is charged for one unit. */
  price: number;
  /** The reference price shown beside the member price. */
  srp: number;
  /** The published price a non-eligible buyer pays. */
  listPrice: number;
  category: MemberPriceCategory;
}

export interface MemberPricing {
  loading: boolean;
  signedIn: boolean;
  /** null when the buyer is not eligible for member pricing. */
  category: MemberPriceCategory | null;
  categoryLabel: string | null;
  version: string;
  /** Keyed by upper-cased SKU, which is what cart lines use. */
  prices: Record<string, MemberPriceEntry>;
  /** The price for a SKU, or null when the published price applies. */
  priceFor: (sku: string | null | undefined) => MemberPriceEntry | null;
  reload: () => Promise<void>;
}

/**
 * The prices that apply to the signed-in buyer.
 *
 * The category is decided by the server from the member's own records — a browser
 * cannot ask for a category, and nothing here is trusted when an order is placed:
 * the checkout recalculates every line in the database.
 */
export function useMemberPricing(): MemberPricing {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [category, setCategory] = useState<MemberPriceCategory | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [version, setVersion] = useState("1");
  const [prices, setPrices] = useState<Record<string, MemberPriceEntry>>({});

  const reload = useCallback(async () => {
    if (!user) {
      setSignedIn(false);
      setCategory(null);
      setCategoryLabel(null);
      setPrices({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("kmd_member_pricing");

    if (error) {
      console.error("Could not read the member pricing:", error.message);
      setLoading(false);
      return;
    }

    const payload = (data ?? {}) as {
      signedIn?: boolean;
      category?: MemberPriceCategory | null;
      categoryLabel?: string | null;
      version?: string;
      prices?: Record<string, MemberPriceEntry>;
    };

    setSignedIn(Boolean(payload.signedIn));
    setCategory(payload.category ?? null);
    setCategoryLabel(payload.categoryLabel ?? null);
    setVersion(payload.version ?? "1");

    const entries: Record<string, MemberPriceEntry> = {};
    for (const [sku, entry] of Object.entries(payload.prices ?? {})) {
      entries[sku.toUpperCase()] = {
        productId: entry.productId,
        sku: entry.sku,
        name: entry.name,
        price: toNumber(entry.price),
        srp: toNumber(entry.srp),
        listPrice: toNumber(entry.listPrice),
        category: entry.category,
      };
    }
    setPrices(entries);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const priceFor = useCallback(
    (sku: string | null | undefined) => (sku ? (prices[sku.toUpperCase()] ?? null) : null),
    [prices],
  );

  return { loading, signedIn, category, categoryLabel, version, prices, priceFor, reload };
}
