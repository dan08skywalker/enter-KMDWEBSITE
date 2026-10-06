import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/kmd/format";
import { packageTier } from "@/lib/kmd/labels";

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

const TIER_STYLES: Record<string, string> = {
  trial: "bg-kmd-surface text-foreground border-border",
  classic: "bg-kmd-primary text-primary-foreground border-transparent",
  gold: "bg-kmd-gold text-[hsl(var(--gold-foreground))] border-transparent",
  platinum: "bg-kmd-platinum text-[hsl(var(--platinum-foreground))] border-transparent",
};

const TIER_ACCENT: Record<string, string> = {
  trial: "text-muted-foreground",
  classic: "text-primary-foreground/70",
  gold: "text-[hsl(var(--gold-foreground))]/70",
  platinum: "text-[hsl(var(--platinum-foreground))]/70",
};

/**
 * Loyalty card artwork. Typography is intentionally open - the member name and
 * card number are the only elevated elements, with no box around each field.
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

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border p-6 shadow-elegant",
        "aspect-[1.6/1] max-w-[420px]",
        TIER_STYLES[key] ?? TIER_STYLES.trial,
        className,
      )}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", TIER_ACCENT[key])}>
              KMD Empire
            </p>
            <p className="mt-1 text-sm font-bold tracking-tight">{tierLabel} Loyalty Card</p>
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", TIER_ACCENT[key])}>
            {status ?? "Active"}
          </span>
        </div>

        <div>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", TIER_ACCENT[key])}>
            Card holder
          </p>
          <p className="mt-[2px] text-[18px] font-bold leading-tight tracking-tight">{memberName}</p>

          <p className={cn("mt-3 text-[10px] font-semibold uppercase tracking-[0.18em]", TIER_ACCENT[key])}>
            Card number
          </p>
          <p className="mt-[2px] font-mono text-[16px] font-semibold leading-tight">
            {cardNumber ?? memberCode}
          </p>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", TIER_ACCENT[key])}>
              Activated
            </p>
            <p className="mt-[2px] text-[13px] font-semibold">{formatDate(activationDate)}</p>
          </div>
          <p className={cn("font-mono text-[10px] tracking-wider", TIER_ACCENT[key])}>{memberCode}</p>
        </div>
      </div>
    </div>
  );
}
