import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/kmd/status-badge";
import { formatPoints } from "@/lib/kmd/format";
import type { EngineRunResult } from "@/lib/kmd/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  PROCESSED: "success",
  PROCESSED_NO_REWARDS: "warning",
  ALREADY_PROCESSED: "warning",
  NOT_QUALIFIED: "warning",
  FAILED: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSED: "Rewards posted",
  PROCESSED_NO_REWARDS: "Engine ran, no eligible level",
  ALREADY_PROCESSED: "Already processed",
  NOT_QUALIFIED: "Not qualified",
  FAILED: "Failed",
};

/**
 * Renders exactly what the reward engine returned: the totals, the per-level
 * awards and every level it skipped, with the engine's own reason text.
 */
export function EngineResultPanel({ result, className }: { result: EngineRunResult; className?: string }) {
  const levels = result.levels ?? [];
  const loyalty = result.loyaltyCredits ?? [];
  const skipped = result.skipped ?? [];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={STATUS_LABEL[result.status] ?? result.status}
          tone={STATUS_TONE[result.status] ?? "neutral"}
        />
        {result.orderNumber ? (
          <span className="font-mono text-xs text-muted-foreground">{result.orderNumber}</span>
        ) : null}
      </div>

      {result.reasonText ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium",
            result.status === "FAILED" || result.status === "NOT_QUALIFIED"
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {result.reasonText}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border px-3 py-2">
          <p className="kmd-label">Points awarded</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatPoints(result.totalPointsAwarded ?? 0)}
          </p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="kmd-label">Loyalty credits awarded</p>
          <p className="mt-1 text-lg font-bold tabular-nums">
            {formatPoints(result.totalLoyaltyAwarded ?? 0)}
          </p>
        </div>
      </div>

      {levels.length > 0 ? (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Level</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Beneficiary</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground">Qty</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground">Per unit</th>
                <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider text-muted-foreground">Points</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={`${level.level}-${level.beneficiaryMemberCode}-${level.transactionId}`} className="border-t">
                  <td className="px-3 py-2 font-semibold">Level {level.level}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono">{level.beneficiaryMemberCode}</span>
                    {level.beneficiaryName ? (
                      <span className="ml-2 text-muted-foreground">{level.beneficiaryName}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono">{level.sku}</td>
                  <td className="px-3 py-2 text-right">{level.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatPoints(level.pointsPerUnit)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatPoints(level.totalPoints)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {loyalty.length > 0 ? (
        <div className="rounded-lg border px-3 py-2">
          <p className="kmd-label flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            Loyalty credits (separate ledger)
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {loyalty.map((entry) => (
              <li key={entry.transactionId} className="flex items-center justify-between">
                <span>
                  Level {entry.level} &middot; <span className="font-mono">{entry.beneficiaryMemberCode}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatPoints(entry.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skipped.length > 0 ? (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
          <p className="kmd-label flex items-center gap-1.5 text-[hsl(var(--warning))]">
            <CircleAlert className="h-3.5 w-3.5" />
            Levels skipped by the engine
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {skipped.map((entry, index) => (
              <li key={`${entry.level}-${entry.reason}-${index}`} className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">L{entry.level}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{entry.reason}</span>
                <span>{entry.reasonText}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {levels.length === 0 && loyalty.length === 0 && skipped.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          The engine returned no ledger activity for this order.
        </p>
      ) : null}
    </div>
  );
}
