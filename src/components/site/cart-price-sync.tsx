import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useCart } from "@/contexts/cart-context";
import { useMemberPricingContext } from "@/contexts/member-pricing-context";
import { formatPeso } from "@/lib/kmd/format";

/**
 * Keeps an unsubmitted bag in step with the buyer's member prices.
 *
 * The prices are re-read after signing in and whenever the buyer's category or the
 * pricing matrix changes, and a change is announced with the old and new figure
 * before anything is submitted. The checkout still recalculates every line on the
 * server, so this is about what the buyer is shown, never about what is charged.
 */
export function CartPriceSync() {
  const cart = useCart();
  const pricing = useMemberPricingContext();
  const appliedRef = useRef<string | null>(null);

  const signature = pricing.loading
    ? null
    : `${pricing.category ?? "none"}:${pricing.version}:${Object.keys(pricing.prices).sort().join(",")}`;

  useEffect(() => {
    if (pricing.loading || !signature) return;

    // Only reprice when the applicable category, version or matrix actually changes.
    if (appliedRef.current === null) {
      appliedRef.current = signature;
      if (pricing.category !== null) {
        cart.applyMemberPrices(pricing.prices);
      }
      return;
    }
    if (appliedRef.current === signature) return;
    appliedRef.current = signature;

    const changed = cart.applyMemberPrices(pricing.prices);
    if (changed.length === 0) {
      if (pricing.category === null) {
        // Losing eligibility is just as important to state as gaining it.
        return;
      }
      return;
    }

    const lines = changed.map((row) => `${row.sku}: ${formatPeso(row.from)} to ${formatPeso(row.to)}`);
    toast.info(
      pricing.categoryLabel
        ? `Bag repriced to your ${pricing.categoryLabel} prices`
        : "Bag repriced to the published prices",
      {
        description: `${changed.length} line${changed.length > 1 ? "s" : ""} changed — ${lines.join(", ")}. Your order total is confirmed again at checkout.`,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, pricing.loading, pricing.category, pricing.prices, pricing.categoryLabel]);

  return null;
}
