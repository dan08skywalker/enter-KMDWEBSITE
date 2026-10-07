import { formatPeso, toNumber } from "@/lib/kmd/format";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  regularPrice?: number | null;
  promoPrice?: number | null;
  effectivePrice: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Shows the promotional price next to the regular price it replaces, with the
 * saving stated in pesos. `effectivePrice` is what the server will charge, so
 * the number on the page and the number in the order can never disagree.
 */
export function PriceTag({
  regularPrice,
  promoPrice,
  effectivePrice,
  size = "md",
  className,
}: PriceTagProps) {
  const charge = toNumber(effectivePrice);
  const was = toNumber(regularPrice);
  const promo = promoPrice === null || promoPrice === undefined ? null : toNumber(promoPrice);
  const hasDiscount = was > 0 && charge > 0 && charge < was;
  const saving = hasDiscount ? was - charge : 0;

  const priceClass =
    size === "lg" ? "text-3xl font-extrabold" : size === "sm" ? "text-base font-bold" : "text-xl font-bold";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", className)}>
      <span className={cn("tabular-nums tracking-tight", priceClass)}>{formatPeso(charge)}</span>

      {hasDiscount ? (
        <>
          <span className="kmd-price-strike">{formatPeso(was)}</span>
          <span className="whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
            Save {formatPeso(saving)}
          </span>
        </>
      ) : null}

      {!hasDiscount && promo !== null && promo === charge && was > charge ? null : null}
    </div>
  );
}
