import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, PackageSearch, Search } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatPeso } from "@/lib/kmd/format";
import { supabase } from "@/integrations/supabase/client";
import type { TrackedOrder } from "@/lib/site/types";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  proof_submitted: "Awaiting payment verification",
  under_review: "Awaiting payment verification",
  confirmed: "Payment verified",
  rejected: "Payment could not be verified",
  cancelled: "Cancelled",
};

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const submit = async () => {
    if (!orderNumber.trim() || !contact.trim()) return;
    setLoading(true);
    setSearched(false);

    const { data, error } = await supabase.rpc("kmd_checkout_track_order", {
      p_order_number: orderNumber.trim(),
      p_contact: contact.trim(),
    });

    setLoading(false);
    setSearched(true);

    if (error) {
      console.error("Order lookup failed:", error.message);
      setOrder(null);
      return;
    }

    const result = (data ?? { found: false }) as unknown as TrackedOrder;
    setOrder(result.found ? result : null);
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Track an order"
        title="Find your order"
        intro="Enter your order number and the email address or mobile number you used at checkout. If you still have the confirmation link, that opens the order directly."
      />

      <Section>
        <div className="mx-auto max-w-2xl">
          <div className="kmd-panel p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="track-number">Order number</Label>
                <Input
                  id="track-number"
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder="KMD-ORDER-001234"
                  className="mt-1.5 font-mono"
                />
              </div>
              <div>
                <Label htmlFor="track-contact">Email or mobile number</Label>
                <Input
                  id="track-contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="you@example.com or 09XX XXX XXXX"
                  className="mt-1.5"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="brand"
              size="lg"
              className="mt-5"
              disabled={loading || !orderNumber.trim() || !contact.trim()}
              onClick={() => void submit()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Looking…
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Find my order
                </>
              )}
            </Button>
          </div>

          {searched && !order ? (
            <div className="kmd-panel mt-4 flex gap-3 p-5">
              <PackageSearch className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs font-semibold">We could not find an order with those details</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Check the order number and that the email or mobile number matches the one you
                  ordered with. For your privacy we do not confirm whether an order exists unless the
                  details match.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/contact">Ask us to look it up</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {order ? (
            <div className="kmd-panel mt-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold">{order.orderNumber}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Placed {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-primary/25 bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                  {STATUS_LABEL[order.status ?? ""] ?? order.status}
                </span>
              </div>

              <ul className="mt-5 divide-y">
                {(order.items ?? []).map((item) => (
                  <li key={item.sku} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} × {formatPeso(item.unitPrice)}
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
                      <span className="text-xs font-semibold text-warning">Quote pending</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-semibold">Total due</dt>
                  <dd className="text-base font-extrabold tabular-nums">
                    {formatPeso(order.totalAmount ?? 0)}
                  </dd>
                </div>
              </dl>

              {order.awaitingPaymentVerification ? (
                <p className="mt-4 rounded-lg border border-warning/35 bg-warning/10 p-3 text-[11px] leading-relaxed text-foreground/85">
                  This order is awaiting payment verification. Open it with your confirmation link to
                  attach a receipt, or contact us if you have already paid.
                </p>
              ) : null}

              {order.courier || order.trackingNumber ? (
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Courier: {order.courier ?? "to be assigned"} · Tracking:{" "}
                  {order.trackingNumber ?? "to follow"}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>
    </SiteShell>
  );
}
