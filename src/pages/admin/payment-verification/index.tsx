import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Eye, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { EngineResultPanel } from "@/components/kmd/engine-result";
import { MemberCell } from "@/components/kmd/member-cell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatPeso } from "@/lib/kmd/format";
import { orderStatus, paymentMethod } from "@/lib/kmd/labels";
import type { EngineRunResult, Order, OrderItem, PaymentProof, Profile } from "@/lib/kmd/types";

interface QueueItem {
  order: Order;
  items: OrderItem[];
  proof: PaymentProof | null;
  buyer: Profile | null;
}

export default function AdminPaymentVerification() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [includeTest, setIncludeTest] = useState(false);
  const [engineResult, setEngineResult] = useState<EngineRunResult | null>(null);
  const [confirmedToday, setConfirmedToday] = useState(0);

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from("orders")
      .select("*")
      .in("status", ["proof_submitted", "under_review"])
      .order("created_at", { ascending: true });
    if (!includeTest) query = query.eq("is_test", false);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [orderResult, confirmedResult] = await Promise.all([
      query,
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gte("rewards_processed_at", startOfDay.toISOString()),
    ]);

    if (orderResult.error) {
      console.error("Could not load the verification queue:", orderResult.error.message);
      setLoading(false);
      return;
    }

    const orders = (orderResult.data ?? []) as unknown as Order[];
    setConfirmedToday(confirmedResult.count ?? 0);

    const built: QueueItem[] = [];
    for (const order of orders) {
      const [itemResult, proofResult, buyerResult] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", order.id),
        supabase
          .from("payment_proofs")
          .select("*")
          .eq("order_id", order.id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("profiles").select("*").eq("id", order.buyer_profile_id).maybeSingle(),
      ]);

      built.push({
        order,
        items: (itemResult.data ?? []) as unknown as OrderItem[],
        proof: (proofResult.data as unknown as PaymentProof | null) ?? null,
        buyer: (buyerResult.data as unknown as Profile | null) ?? null,
      });
    }

    setQueue(built);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["orders", "payment_proofs"], () => void load());

  const runAction = async (orderId: string, action: string, extra: Record<string, unknown>, message: string) => {
    const outcome = await invokeFunction<{ ok?: boolean; result?: EngineRunResult }>("admin-actions", {
      action,
      orderId,
      ...extra,
    });

    if (!outcome.ok) {
      toast.error("Action failed", { description: outcome.error });
      return { error: outcome.error ?? "Action failed" };
    }

    const result = outcome.data?.result ?? null;
    if (result && typeof result.status === "string") setEngineResult(result);
    toast.success(message);
    await load();
    return {};
  };

  const viewProof = async (orderId: string) => {
    const outcome = await invokeFunction<{ url?: string }>("admin-actions", { action: "proof_url", orderId });
    if (!outcome.ok || !outcome.data?.url) {
      toast.error("Could not open the payment proof", { description: outcome.error });
      return;
    }
    window.open(outcome.data.url, "_blank", "noopener,noreferrer");
  };

  const totalWaiting = queue.length;
  const windowTotal = useMemo(
    () => queue.reduce((sum, item) => sum + Number(item.order.total_amount ?? 0), 0),
    [queue],
  );

  return (
    <>
      <PageHeader
        title="Payment Verification"
        description="Review submitted payment proofs. Confirming payment is the transition that triggers the reward engine exactly once."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders Waiting" value={String(totalWaiting)} icon={BadgeCheck} accent="gold" loading={loading} />
        <StatCard
          label="Confirmed Today"
          value={String(confirmedToday)}
          hint="Rewards processed"
          icon={CheckCircle2}
          accent="success"
          loading={loading}
        />
        <StatCard label="Value Awaiting Review" value={formatPeso(windowTotal)} accent="primary" loading={loading} />
      </div>

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Moving an order from <span className="font-semibold">under review</span> to{" "}
          <span className="font-semibold">confirmed</span> runs the reward engine: it traces the buyer's
          sponsor chain from Level 1 to Level 5, calculates each configured bonus and writes the ledger
          entries in one transaction. If anything is misconfigured the confirmation itself is rolled back
          and the exact reason is shown, so a partial payout can never be committed.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch id="verify-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="verify-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1].map((row) => (
            <div key={row} className="kmd-panel p-5">
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="kmd-panel">
          <EmptyState
            icon={BadgeCheck}
            title="Nothing to verify"
            description="No order is currently waiting for payment verification. Submitted proofs appear here automatically."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => {
            const status = orderStatus(item.order.status);
            const proofDescriptor = item.proof ? paymentMethod(item.proof.method) : null;

            return (
              <div key={item.order.id} className="kmd-panel p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{item.order.order_number}</span>
                      <StatusBadge label={status.label} tone={status.tone} />
                      {item.order.is_test ? <StatusBadge label="Test" tone="platinum" /> : null}
                    </div>
                    {item.buyer ? <MemberCell profile={item.buyer} /> : null}
                  </div>
                  <div className="text-right">
                    <p className="kmd-label">Declared amount</p>
                    <p className="text-lg font-bold">{formatPeso(item.proof?.amount ?? item.order.total_amount)}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2 text-xs">
                    <p className="kmd-label">Purchase</p>
                    <ul className="space-y-1">
                      {item.items.map((line) => (
                        <li key={line.id} className="flex items-center justify-between">
                          <span>
                            {line.product_name}{" "}
                            <span className="font-mono text-muted-foreground">{line.sku}</span>
                          </span>
                          <span className="tabular-nums">
                            {line.quantity} x {formatPeso(line.unit_price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="pt-1 text-muted-foreground">
                      Submitted {formatDateTime(item.proof?.submitted_at)} &middot; order created{" "}
                      {formatDateTime(item.order.created_at)}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="kmd-label">Payment proof</p>
                      {item.proof ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <StatusBadge label={proofDescriptor?.label ?? "Unknown"} tone={proofDescriptor?.tone ?? "neutral"} />
                          <span className="font-mono">{item.proof.reference_number ?? "no reference"}</span>
                          {item.proof.bank_name ? <span>{item.proof.bank_name}</span> : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void viewProof(item.order.id)}
                            disabled={!item.proof.proof_path}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {item.proof.proof_path ? "View proof" : "No file"}
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">No payment proof recorded.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {item.order.status === "proof_submitted" ? (
                        <ConfirmActionDialog
                          trigger={
                            <Button variant="outline" size="sm">
                              <Loader2 className="h-3.5 w-3.5" />
                              Mark under review
                            </Button>
                          }
                          title={`Move ${item.order.order_number} to under review?`}
                          description="The order remains unqualified, so no rewards are generated yet."
                          confirmLabel="Mark under review"
                          reasonRequired
                          reasonLabel="Reason"
                          onConfirm={(reason) =>
                            runAction(
                              item.order.id,
                              "set_order_status",
                              { status: "under_review", reason },
                              "Order marked under review",
                            )
                          }
                        />
                      ) : null}

                      <ConfirmActionDialog
                        trigger={
                          <Button size="sm">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirm payment
                          </Button>
                        }
                        title={`Confirm payment for ${item.order.order_number}?`}
                        description="This runs the reward engine once: Level 1 to Level 5 are traced, each configured bonus is calculated and the ledger entries are posted in a single transaction. Confirming again returns 'already processed' and pays nothing extra."
                        confirmLabel="Confirm and run the engine"
                        reasonRequired
                        reasonLabel="Reason for confirming"
                        onConfirm={(reason) =>
                          runAction(item.order.id, "confirm_payment", { reason }, "Payment confirmed")
                        }
                      />

                      <ConfirmActionDialog
                        trigger={
                          <Button size="sm" variant="outline" className="text-destructive">
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        }
                        title={`Reject payment for ${item.order.order_number}?`}
                        description="The order is closed as rejected and no rewards are ever generated for it."
                        confirmLabel="Reject payment"
                        destructive
                        reasonRequired
                        reasonLabel="Reason for rejection"
                        onConfirm={(reason) =>
                          runAction(item.order.id, "reject_payment", { reason }, "Payment rejected")
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={engineResult !== null} onOpenChange={(open) => !open && setEngineResult(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reward engine result</DialogTitle>
            <DialogDescription>
              The literal response from the backend for this confirmation.
            </DialogDescription>
          </DialogHeader>
          {engineResult ? <EngineResultPanel result={engineResult} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
