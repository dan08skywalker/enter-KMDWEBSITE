import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/kmd/format";
import { packageTier } from "@/lib/kmd/labels";
import { LOYALTY_CARD_ART, LOYALTY_CARD_ASPECT } from "@/lib/kmd/constants";

export type LoyaltyTier = "trial" | "classic" | "gold" | "platinum";

interface LoyaltyCardProps {
  tier: LoyaltyTier | string;
  memberName: string;
  memberCode: string;
  cardNumber?: string | null;
  activationDate?: string | null;
  status?: string | null;
  className?: string;
}

/** Fallback surface for a tier without cover artwork. */
const TIER_STYLES: Record<string, string> = {
  trial: "bg-kmd-surface text-foreground border-border",
  classic: "bg-kmd-primary text-primary-foreground border-transparent",
  gold: "bg-kmd-gold text-[hsl(var(--gold-foreground))] border-transparent",
  platinum: "bg-kmd-platinum text-[hsl(var(--platinum-foreground))] border-transparent",
};

/**
 * Text colours chosen per cover: the classic cover is silver, gold is gold and
 * platinum is black, so each one takes the type that reads on it.
 */
const TIER_TEXT: Record<string, { value: string; label: string }> = {
  trial: { value: "text-foreground", label: "text-muted-foreground" },
  classic: { value: "text-foreground", label: "text-foreground/60" },
  gold: {
    value: "text-[hsl(var(--gold-foreground))]",
    label: "text-[hsl(var(--gold-foreground))]/60",
  },
  platinum: {
    value: "text-[hsl(var(--platinum-foreground))]",
    label: "text-[hsl(var(--platinum-foreground))]/65",
  },
};

/**
 * Loyalty card. The tier cover is the card itself; the member name and card
 * number stay the only elevated elements, with no box around each field.
 *
 * Card text is confined to the left half because every cover carries the brand
 * mark in the top-right corner and embossed leaves along the bottom-right.
 */
export function LoyaltyCard({
  tier,
  memberName,
  memberCode,
  cardNumber,
  activationDate,
  status,
  className,
}: LoyaltyCardProps) {
  const key = (tier ?? "trial") as string;
  const tierLabel = packageTier(key).label;
  const art = LOYALTY_CARD_ART[key as "classic" | "gold" | "platinum"];
  const text = TIER_TEXT[key] ?? TIER_TEXT.trial;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border shadow-elegant",
        LOYALTY_CARD_ASPECT,
        "max-w-[420px]",
        art ? "border-transparent" : (TIER_STYLES[key] ?? TIER_STYLES.trial),
        className,
      )}
    >
      {art ? (
        <img
          src={art}
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
      ) : null}

      {/* The title may use the full column width; the details below stay narrower
          so they never reach the cover's embossed leaves. */}
      <div className="relative flex h-full w-[66%] flex-col justify-between p-4 sm:w-[70%] sm:p-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", text.label)}>
              KMD Empire
            </p>
            <span className={cn("text-[9px] font-semibold uppercase tracking-[0.16em]", text.label)}>
              {status ?? "Active"}
            </span>
          </div>
          <p
            className={cn(
              "mt-1 font-tahoma text-[18px] font-bold uppercase leading-[1.15] break-words",
              text.value,
            )}
          >
            {tierLabel} Loyalty Card
          </p>
        </div>

        <div className="w-[80%]">
          {/* The captions are dropped on the narrowest cards, where the 18px title
              and a long name need the room. The values themselves always show. */}
          <p className={cn("max-sm:hidden text-[10px] font-semibold uppercase tracking-[0.18em]", text.label)}>
            Card holder
          </p>
          {/* Uppercase is a display treatment only: the stored name is untouched. */}
          <p
            className={cn(
              "mt-[2px] font-tahoma text-[14px] font-bold uppercase leading-tight break-words",
              text.value,
            )}
          >
            {memberName}
          </p>

          <p className={cn("mt-2 max-sm:hidden text-[10px] font-semibold uppercase tracking-[0.18em]", text.label)}>
            Card number
          </p>
          <p className={cn("mt-[2px] font-mono text-[16px] font-semibold leading-tight", text.value)}>
            {cardNumber ?? memberCode}
          </p>
        </div>

        <div className="w-[80%]">
          <div className="flex items-baseline gap-2">
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", text.label)}>
              Activated
            </p>
            <p className={cn("text-[13px] font-semibold", text.value)}>
              {formatDate(activationDate)}
            </p>
          </div>
          <p className={cn("mt-1 font-mono text-[10px] tracking-wider", text.label)}>{memberCode}</p>
        </div>
      </div>
    </div>
  );
}
