import { cn } from "@/lib/utils";
import { formatPeso, formatPoints } from "@/lib/kmd/format";

interface PointsProps {
  value: number | string | null | undefined;
  direction?: string | null;
  className?: string;
  showSign?: boolean;
}

/** Point figure with tabular numerals and credit/debit colouring. */
export function Points({ value, direction, className, showSign = false }: PointsProps) {
  const sign = showSign ? (direction === "DEBIT" ? "-" : "+") : "";
  const numeric = Number(value ?? 0);

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        showSign && direction === "DEBIT" && "text-destructive",
        showSign && direction !== "DEBIT" && "text-[hsl(var(--success))]",
        numeric === 0 && "text-muted-foreground",
        className,
      )}
    >
      {sign}
      {formatPoints(numeric)}
    </span>
  );
}

interface MoneyProps {
  points: number | string | null | undefined;
  rate?: number;
  className?: string;
}

/** Peso equivalent of a point amount (1 point = the configured rate). */
export function Money({ points, rate = 1, className }: MoneyProps) {
  return (
    <span className={cn("tabular-nums text-muted-foreground", className)}>
      {formatPeso(points, rate)}
    </span>
  );
}

export function PointsWithMoney({
  points,
  rate = 1,
  className,
}: {
  points: number | string | null | undefined;
  rate?: number;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-col leading-tight", className)}>
      <Points value={points} />
      <Money points={points} rate={rate} className="text-[11px]" />
    </span>
  );
}
