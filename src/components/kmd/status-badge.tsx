import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/kmd/labels";

export type { Tone };

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

/** A consistent status pill driven by the label tone map. */
export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
