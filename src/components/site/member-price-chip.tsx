import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marks a price that comes from the buyer's membership category rather than the
 * published price list. Shown wherever a member sees their own price.
 */
export function MemberPriceChip({
  label,
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  if (!label) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-accent/40 bg-gold/12 px-2 py-0.5 text-[11px] font-bold text-accent",
        className,
      )}
    >
      <BadgeCheck className="h-3 w-3" />
      {label}
    </span>
  );
}
