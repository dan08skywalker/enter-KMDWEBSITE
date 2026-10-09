import { useState } from "react";
import { Check, Copy, ExternalLink, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DIGITAL_ORDER_NOTE,
  JNT_LABEL,
  JNT_TRACKING_URL,
  TRACKING_INSTRUCTION,
  TRACKING_UNAVAILABLE,
  courierLabel,
  fulfillmentLabel,
  isJntCourier,
} from "@/lib/kmd/courier";

/**
 * Copy the tracking number exactly as the fulfilment record stores it.
 *
 * Clipboard access can be refused by the browser, in which case the member is told
 * to select the number instead of being left with a silent no-op.
 */
export function CopyTrackingButton({
  value,
  disabled = false,
  className,
  label = "Copy Tracking Number",
}: {
  value: string | null;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success("Tracking number copied", { description: value });
    } catch {
      console.error("Clipboard access was refused");
      toast.error("Could not copy automatically", {
        description: "Select the tracking number and copy it, or type it into the tracking page.",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-7 gap-1.5 px-2 text-[11px]", className)}
      onClick={() => void copy()}
      disabled={disabled || !value}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-3 w-3 text-[hsl(var(--success))]" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/**
 * The "Track with J&T Express" action. It is only offered when the order really is
 * a J&T shipment, and it always opens the same fixed tracking page in a new tab so
 * the dashboard stays where it is.
 */
export function TrackWithJntButton({
  courier,
  className,
  size = "sm",
}: {
  courier?: string | null;
  className?: string;
  size?: "sm" | "lg";
}) {
  if (!isJntCourier(courier)) return null;

  return (
    <Button asChild variant="outline" size={size} className={cn("gap-1.5", className)}>
      <a href={JNT_TRACKING_URL} target="_blank" rel="noopener noreferrer">
        <ExternalLink className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
        Track with {JNT_LABEL}
      </a>
    </Button>
  );
}

/**
 * Full tracking block for the order detail page: the courier, the stored tracking
 * number, the copy action, the J&T link and the short instruction.
 */
export function CourierTrackingPanel({
  courier,
  trackingNumber,
  fulfillmentStatus,
  digitalOnly,
}: {
  courier?: string | null;
  trackingNumber?: string | null;
  fulfillmentStatus?: string | null;
  digitalOnly: boolean;
}) {
  // A digital order has nothing to ship, so no courier tracking is shown at all.
  if (digitalOnly) return null;

  const number = (trackingNumber ?? "").trim();
  const hasNumber = number.length > 0;

  return (
    <div className="kmd-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-primary" />
            Fulfilment and courier tracking
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tracking comes from the fulfilment record on this order. Status updates are handled by the
            courier, not shown here.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold capitalize text-muted-foreground">
          {fulfillmentLabel(fulfillmentStatus)}
        </span>
      </div>

      <Separator className="my-4" />

      <dl className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Courier</dt>
          <dd className="font-semibold">{courierLabel(courier)}</dd>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <dt className="text-muted-foreground">Tracking number</dt>
          <dd>
            {hasNumber ? (
              <span className="font-mono text-xs font-semibold tracking-wide">{number}</span>
            ) : (
              <span className="text-xs text-muted-foreground">{TRACKING_UNAVAILABLE}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CopyTrackingButton value={hasNumber ? number : null} disabled={!hasNumber} label="Copy Tracking Number" />
        <TrackWithJntButton courier={courier} size="sm" />
      </div>

      {hasNumber ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{TRACKING_INSTRUCTION}</p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          No tracking number has been assigned to this order yet. It appears here as soon as our team
          records the courier booking.
        </p>
      )}
    </div>
  );
}

/**
 * Compact variant used in the My Orders table, kept to the same wording and the
 * same empty state as the detail view.
 */
export function CourierTrackingCell({
  courier,
  trackingNumber,
  digitalOnly,
  className,
}: {
  courier?: string | null;
  trackingNumber?: string | null;
  digitalOnly: boolean;
  className?: string;
}) {
  if (digitalOnly) {
    return <span className={cn("text-xs text-muted-foreground", className)}>{DIGITAL_ORDER_NOTE}</span>;
  }

  const number = (trackingNumber ?? "").trim();
  const hasNumber = number.length > 0;

  return (
    <div className={cn("flex min-w-[13rem] flex-col gap-1.5", className)}>
      {hasNumber ? (
        <span className="font-mono text-xs font-semibold tracking-wide">{number}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{TRACKING_UNAVAILABLE}</span>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <CopyTrackingButton value={hasNumber ? number : null} disabled={!hasNumber} />
        <TrackWithJntButton courier={courier} />
      </div>

      {hasNumber ? (
        <span className="text-[10px] leading-relaxed text-muted-foreground">{TRACKING_INSTRUCTION}</span>
      ) : null}
    </div>
  );
}
