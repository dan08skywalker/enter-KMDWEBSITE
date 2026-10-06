import { Check, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { orderStatus } from "@/lib/kmd/labels";
import { formatDateTime } from "@/lib/kmd/format";
import type { OrderStatus } from "@/lib/kmd/types";

const FLOW: Array<{ key: OrderStatus; label: string }> = [
  { key: "pending_payment", label: "Pending Payment" },
  { key: "proof_submitted", label: "Proof Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "confirmed", label: "Confirmed" },
];

/**
 * Shows where an order sits in the verification flow. Confirmed is the stage that
 * triggers the reward engine, and that is called out explicitly.
 */
export function OrderStatusTimeline({
  status,
  rewardsProcessed,
  rewardsProcessedAt,
  className,
}: {
  status: OrderStatus | string;
  rewardsProcessed?: boolean;
  rewardsProcessedAt?: string | null;
  className?: string;
}) {
  const closed = status === "rejected" || status === "cancelled";
  const currentIndex = FLOW.findIndex((step) => step.key === status);

  return (
    <div className={cn("space-y-4", className)}>
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        {FLOW.map((step, index) => {
          const done = !closed && currentIndex >= index;
          const isCurrent = !closed && currentIndex === index;
          const descriptor = orderStatus(step.key);

          return (
            <li key={step.key} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                  done
                    ? "border-transparent bg-kmd-primary text-primary-foreground"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-xs font-semibold",
                    isCurrent ? "text-primary" : "text-foreground",
                  )}
                >
                  {step.label}
                </span>
                {isCurrent ? (
                  <span className="block text-[10px] text-muted-foreground">{descriptor.label}</span>
                ) : null}
              </span>
              {index < FLOW.length - 1 ? (
                <span className="ml-1 hidden h-px flex-1 bg-border sm:block" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {closed ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          {orderStatus(status).label} — this order was closed before
          {" "}
          {status === "rejected" ? "payment verification" : "payment"}, so no reward was generated.
        </p>
      ) : rewardsProcessed ? (
        <p className="rounded-lg border border-success/30 bg-success/8 px-3 py-2 text-xs font-medium text-[hsl(var(--success))]">
          Reward engine processed this purchase
          {rewardsProcessedAt ? ` on ${formatDateTime(rewardsProcessedAt)}` : ""} — ledger entries
          were posted automatically.
        </p>
      ) : status === "confirmed" ? (
        <p className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-xs font-medium text-[hsl(var(--warning))]">
          Payment is confirmed. Reward processing has not completed — an administrator can retry it
          from Reward Diagnostics.
        </p>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No commission is generated until payment is confirmed.
        </p>
      )}
    </div>
  );
}
