import { useTranslation } from "react-i18next";
import { formatPeso, toNumber } from "@/lib/kmd/format";
import { useMemberPricingContext } from "@/contexts/member-pricing-context";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  regularPrice?: number | null;
  promoPrice?: number | null;
  effectivePrice: number;
  /** When given, the buyer's member price for this SKU is shown instead. */
  sku?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Shows what this buyer will actually be charged.
 *
 * For an eligible member that is their member price, labelled and shown against the
 * reference price it replaces; for everyone else it is the published price. The
 * figures come from the same pricing matrix the server charges from, so the page and
 * the order cannot disagree.
 */
export function PriceTag({
  regularPrice,
  promoPrice,
  effectivePrice,
  sku,
  size = "md",
  className,
}: PriceTagProps) {
  const { t } = useTranslation();
  const pricing = useMemberPricingContext();
  const member = pricing.priceFor(sku);

  const charge = member ? member.price : toNumber(effectivePrice);
  const was = member
    ? toNumber(member.srp) || toNumber(regularPrice)
    : toNumber(regularPrice);
  const promo = promoPrice === null || promoPrice === undefined ? null : toNumber(promoPrice);
  const hasDiscount = was > 0 && charge > 0 && charge < was;
  const saving = hasDiscount ? was - charge : 0;

  const priceClass =
    size === "lg" ? "text-3xl font-extrabold" : size === "sm" ? "text-base font-bold" : "text-xl font-bold";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className={cn("tabular-nums tracking-tight", priceClass)}>{formatPeso(charge)}</span>

      {member && pricing.categoryLabel ? (
        <span className="whitespace-nowrap rounded-full border border-accent/40 bg-gold/12 px-2 py-0.5 text-[11px] font-bold text-accent">
          {t("price.memberLabel", { category: pricing.categoryLabel })}
        </span>
      ) : null}

      {hasDiscount ? (
        <>
          <span className="kmd-price-strike">{formatPeso(was)}</span>
          <span className="whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
            {t("price.save", { amount: formatPeso(saving) })}
          </span>
        </>
      ) : null}

      {!hasDiscount && promo !== null && promo === charge && was > charge ? null : null}
    </div>
  );
}
