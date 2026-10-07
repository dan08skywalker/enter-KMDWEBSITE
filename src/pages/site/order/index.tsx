import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Package,
  Truck,
} from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { PaymentDetails } from "@/components/site/payment-details";
import { ProofPicker, uploadProof, useProofFile } from "@/components/site/proof-upload";
import { readOrderToken } from "@/pages/site/checkout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/contexts/store-context";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatPeso } from "@/lib/kmd/format";
import type { TrackedOrder } from "@/lib/site/types";

const STATUS_COPY: Record<string, { label: string; detail: string; tone: "wait" | "ok" | "bad" }> = {
  pending_payment: {
    label: "Awaiting your payment",
    detail: "Send the exact amount to the account below, then attach your receipt.",
    tone: "wait",
  },
  proof_submitted: {
    label: "Awaiting payment verification",
    detail: "We have your receipt and our team is checking it against the amount due.",
    tone: "wait",
  },
  under_review: {
    label: "Awaiting payment verification",
    detail: "Our team is reviewing your payment now.",
    tone: "wait",
  },
  confirmed: {
    label: "Payment verified",
    detail: "Your order is confirmed and being prepared.",
    tone: "ok",
  },
  rejected: {
    label: "Payment could not be verified",
    detail: "Please check your payment details and send us a new receipt.",
    tone: "bad",
  },
  cancelled: {
    label: "This order was cancelled",
    detail: "No payment is due on a cancelled order.",
    tone: "bad",
  },
};

export default function OrderConfirmationPage() {
  const { orderNumber = "" } = useParams();
  const { paymentAccounts } = useStore();

  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorised, setUnauthorised] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const proofState = useProofFile();

  const load = useCallback(async () => {
    setLoading(true);
    const token = readOrderToken(orderNumber);

    const { data, error } = await supabase.rpc("kmd_checkout_track_order", {
      p_order_number: orderNumber,
      p_contact: token,
    });

    if (error) {
      console.error("Could not load the order:", error.message);
      setUnauthorised(true);
      setLoading(false);
      return;
    }

    const result = (data ?? { found: false }) as TrackedOrder;
    if (!result.found) {
      setUnauthorised(true);
    } else {
      setOrder(result);
    }
    setLoading(false);
  }, [orderNumber]);

  useEffect(() => {
    void load();
  }, [load]);

  const attachProof = async () => {
    if (!order?.orderNumber || !proofState.proof) {
      toast({
        title: "Attach a receipt first",
        description: "Add a photo or PDF of your proof of payment.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const path = await uploadProof(order.orderNumber, proofState.proof.file);

    if (!path) {
      setSubmitting(false);
      toast({
        title: "Upload failed",
        description: "We could not upload that file. Please try a smaller one.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase.rpc("kmd_checkout_submit_proof", {
      p_payload: {
        orderNumber: order.orderNumber,
        accessToken: readOrderToken(order.orderNumber),
        method: order.paymentMethod ?? "other",
        proofPath: path,
        amount: order.totalAmount ?? null,
      },
    });

    setSubmitting(false);

    const result = (data ?? {}) as { status?: string; reasonText?: string };
    if (error || result.status === "FAILED") {
      toast({
        title: "Receipt not attached",
        description: result.reasonText ?? "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    proofState.clear();
    toast({ title: "Receipt attached", description: result.reasonText ?? "Thank you." });
    void load();
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </SiteShell>
    );
  }

  if (unauthorised || !order?.found) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Order"
          title="We could not open that order"
          intro="For your privacy an order can only be opened with the link from your checkout session, or with the order number plus the email or mobile number you ordered with."
        />
        <Section>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="brand">
              <Link to="/track">Track my order</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">Contact support</Link>
            </Button>
          </div>
        </Section>
      </SiteShell>
    );
  }

  const status = STATUS_COPY[order.status ?? "pending_payment"] ?? STATUS_COPY.pending_payment;
  const needsProof = order.status === "pending_payment" || order.status === "rejected";
  const toneClass =
    status.tone === "ok"
      ? "border-success/35 bg-success/10"
      : status.tone === "bad"
        ? "border-destructive/35 bg-destructive/10"
        : "border-warning/35 bg-warning/10";

  return (
    <SiteShell>
      <PageHero
        eyebrow={`Order ${order.orderNumber}`}
        title={status.label}
        intro={status.detail}
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <section className={`rounded-xl border p-5 ${toneClass}`}>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {status.tone === "ok" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : status.tone === "bad" ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                {status.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/85">{status.detail}</p>
              {order.createdAt ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Placed {formatDateTime(order.createdAt)}
                </p>
              ) : null}
            </section>

            {needsProof ? (
              <section className="kmd-panel p-6">
                <h2 className="text-sm font-semibold">Attach your proof of payment</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid {order.paymentMethod ? `by ${order.paymentMethod}` : "already"}? Attach the
                  receipt here and we will verify it.
                </p>

                <div className="mt-4">
                  <ProofPicker proofState={proofState} />
                </div>

                <Button
                  type="button"
                  variant="brand"
                  className="mt-4"
                  disabled={submitting}
                  onClick={() => void attachProof()}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="h-4 w-4" />
                      Submit receipt
                    </>
                  )}
                </Button>
              </section>
            ) : null}

            <section className="kmd-panel p-6">
              <h2 className="text-sm font-semibold">What you ordered</h2>
              <ul className="mt-4 divide-y">
                {(order.items ?? []).map((item) => (
                  <li key={item.sku} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {item.sku} · {item.quantity} × {formatPeso(item.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold tabular-nums">
                      {formatPeso(item.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatPeso(order.subtotal ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="tabular-nums">
                    {order.isShippingQuoted ? (
                      formatPeso(order.shippingFee ?? 0)
                    ) : (
                      <span className="text-xs font-semibold text-warning">
                        Quote pending — we will confirm before dispatch
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-semibold">Total due</dt>
                  <dd className="text-lg font-extrabold tabular-nums">
                    {formatPeso(order.totalAmount ?? 0)}
                  </dd>
                </div>
              </dl>
            </section>

            {order.fulfillmentStatus && order.fulfillmentStatus !== "unfulfilled" ? (
              <section className="kmd-panel flex gap-3 p-5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold">
                    Fulfilment: {order.fulfillmentStatus}
                  </p>
                  {order.courier || order.trackingNumber ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {order.courier ? `${order.courier} · ` : ""}
                      {order.trackingNumber ?? "tracking number to follow"}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-4">
            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Your order number</p>
              <p className="mt-2 flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{order.orderNumber}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    void navigator.clipboard.writeText(order.orderNumber ?? "");
                    toast({ title: "Order number copied" });
                  }}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Keep this number. You can reopen this order from the tracking page with it plus the
                email or mobile number you used.
              </p>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Where to pay</p>
              <div className="mt-3">
                <PaymentDetails
                  accounts={paymentAccounts}
                  selectedMethod={order.paymentMethod}
                  readOnly
                />
              </div>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Need help?</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                If anything looks wrong, contact us with your order number and we will sort it out.
              </p>
              <div className="mt-3 grid gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/track">
                    <Package className="h-3.5 w-3.5" />
                    Track an order
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/contact">Contact support</Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </SiteShell>
  );
}
