import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type Accent = "primary" | "gold" | "platinum" | "success";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: Accent;
  loading?: boolean;
  className?: string;
}

const ACCENTS: Record<Accent, { icon: string; value: string }> = {
  primary: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  gold: {
    icon: "bg-gold/15 text-[hsl(var(--gold))]",
    value: "text-[hsl(var(--gold))]",
  },
  platinum: {
    icon: "bg-platinum/20 text-[hsl(var(--platinum))]",
    value: "text-[hsl(var(--platinum))]",
  },
  success: {
    icon: "bg-success/12 text-[hsl(var(--success))]",
    value: "text-[hsl(var(--success))]",
  },
};

/** Primary balance figure used across both dashboards. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
  loading = false,
  className,
}: StatCardProps) {
  const styles = ACCENTS[accent];

  return (
    <div className={cn("kmd-panel animate-kmd-fade-up p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kmd-label">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <p className={cn("kmd-figure mt-2 truncate", styles.value)}>{value}</p>
          )}
          {loading ? (
            <Skeleton className="mt-2 h-3 w-24" />
          ) : hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
