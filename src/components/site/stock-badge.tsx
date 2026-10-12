import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Infinity as InfinityIcon, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  inStock: boolean;
  lowStock: boolean;
  availableQuantity: number | null;
  isDigital?: boolean;
  className?: string;
}

/**
 * Stock state as it is actually recorded. A product with no stock record shows
 * as out of stock rather than implying availability we cannot honour.
 */
export function StockBadge({
  inStock,
  lowStock,
  availableQuantity,
  isDigital = false,
  className,
}: StockBadgeProps) {
  const { t } = useTranslation();
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold";

  if (isDigital) {
    return (
      <span className={cn(base, "border-primary/25 bg-secondary text-secondary-foreground", className)}>
        <InfinityIcon className="h-3.5 w-3.5" />
        {t("stock.deliveredDigitally")}
      </span>
    );
  }

  if (availableQuantity === null) {
    return (
      <span className={cn(base, "border-primary/25 bg-secondary text-secondary-foreground", className)}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t("stock.available")}
      </span>
    );
  }

  if (!inStock) {
    return (
      <span className={cn(base, "border-destructive/30 bg-destructive/10 text-destructive", className)}>
        <PackageX className="h-3.5 w-3.5" />
        {t("common.outOfStock")}
      </span>
    );
  }

  if (lowStock) {
    return (
      <span className={cn(base, "border-warning/35 bg-warning/12 text-warning", className)}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {t("stock.onlyLeft", { count: availableQuantity })}
      </span>
    );
  }

  return (
    <span className={cn(base, "border-primary/25 bg-secondary text-secondary-foreground", className)}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      {t("stock.inStockAvailable", { count: availableQuantity })}
    </span>
  );
}
