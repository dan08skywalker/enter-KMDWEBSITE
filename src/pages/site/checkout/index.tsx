import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Lock,
  MapPin,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { PaymentDetails, methodLabel } from "@/components/site/payment-details";
import {
  WalletPaymentOption,
  WalletPaymentSummary,
} from "@/components/site/wallet-payment";
import { ProofPicker, uploadProof, useProofFile } from "@/components/site/proof-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/kmd/empty-state";
import { useCart } from "@/contexts/cart-context";
import { useStore } from "@/contexts/store-context";
import { useAuth } from "@/contexts/auth-context";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPeso } from "@/lib/kmd/format";
import type { PlacedOrder, QuoteResult } from "@/lib/site/types";

/** The payment method value that means "pay from the Shopping Wallet". */
const WALLET_METHOD = "shopping_wallet";

/** Order tokens let a guest reopen their own order after a reload. */
export function rememberOrderToken(orderNumber: string, token: string) {
  try {
    window.sessionStorage.setItem(`kmd.order.${orderNumber}`, token);
  } catch {
    // Storage can be unavailable; the tracking form is the fallback.
  }
}

export function readOrderToken(orderNumber: string): string | null {
  try {
    return window.sessionStorage.getItem(`kmd.order.${orderNumber}`);
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const cart = useCart();
  const { deliveryZones, paymentAccounts, loading: storeLoading } = useStore();
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [address, setAddress] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [consent, setConsent] = useState(false);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // Shopping Wallet payment: one key per attempt so the server can recognise a
  // resend, and the confirmation step sits between the button and the charge.
  const wallet = useWalletBalance();
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletKey, setWalletKey] = useState<string | null>(null);

  const proofState = useProofFile();

  useEffect(() => {
    if (profile) {
      setName((current) => current || profile.full_name);
      setEmail((current) => current || profile.email);
      setPhone((current) => current || (profile.mobile_number ?? ""));
    }
  }, [profile]);

  useEffect(() => {
    if (!paymentMethod && paymentAccounts.length > 0) {
      setPaymentMethod(paymentAccounts[0].method);
    }
  }, [paymentAccounts, paymentMethod]);

  const items = useMemo(
    () => cart.lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
    [cart.lines],
  );

  const refreshQuote = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    setQuoting(true);
    const { data, error } = await supabase.rpc("kmd_checkout_quote", {
      p_items: items,
      p_zone_id: cart.requiresShipping && zoneId ? zoneId : null,
    });
    setQuoting(false);

    if (error) {
      console.error("Quote failed:", error.message);
      setQuoteError("We could not price your cart just now. Please refresh the page.");
      setQuote(null);
      return;
    }

    const result = (data ?? { status: "FAILED" }) as unknown as QuoteResult;
    if (result.status === "FAILED") {
      setQuoteError(result.reasonText ?? "Your cart could not be priced.");
      setQuote(null);
      return;
    }

    setQuoteError(null);
    setQuote(result);
  }, [items, zoneId, cart.requiresShipping]);

  useEffect(() => {
    void refreshQuote();
  }, [refreshQuote]);

  const selectedZone = deliveryZones.find((zone) => zone.id === zoneId) ?? null;
  const shippingPending =
    cart.requiresShipping && (!selectedZone || !selectedZone.isConfigured);
  const noPaymentAccount = !storeLoading && paymentAccounts.length === 0;

  const isWalletPayment = paymentMethod === WALLET_METHOD;
  const orderTotal = quote?.total ?? cart.subtotal;
  // A pending delivery fee would leave part of the order unpaid, so a wallet
  // payment can only be offered once the total is final.
  const totalFinal = Boolean(quote) && quote?.shippingQuoted !== false;

  const validate = (): string | null => {
    if (items.length === 0) return "Your cart is empty.";
    if (!name.trim()) return "Enter the name we should deliver to.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))
      return "Enter a valid email address so we can send your order confirmation.";
    if (!phone.trim()) return "Enter a contact mobile number.";
    if (cart.requiresShipping) {
      if (!zoneId) return "Choose your delivery area.";
      if (!address.trim()) return "Enter your street address.";
      if (!city.trim()) return "Enter your city or municipality.";
      if (!province.trim()) return "Enter your province.";
    }
    if (!paymentMethod) return "Choose how you will pay.";
    if (isWalletPayment) {
      if (!session) return "Sign in to pay with your Shopping Wallet.";
      if (!totalFinal)
        return "Your delivery fee has not been finalised yet, so the Shopping Wallet cannot cover the full total.";
      if (wallet.balance < orderTotal)
        return "Your Shopping Wallet balance does not cover this order yet. Convert Unilevel Points to your wallet and try again.";
    } else if (!proofState.proof) {
      return "Attach a photo or PDF of your proof of payment.";
    }
    if (!consent) return "Please accept the terms and privacy policy to continue.";
    return null;
  };

  /**
   * Pay an order from the Shopping Wallet. The order is created and charged in
   * one database transaction: if the wallet cannot settle it, nothing is created
   * and the bag is left exactly as it is.
   */
  const payWithWallet = async () => {
    if (!session) {
      setWalletError("Sign in to pay with your Shopping Wallet.");
      return;
    }

    setWalletBusy(true);
    setWalletError(null);

    const { data, error } = await supabase.rpc("kmd_checkout_place_wallet_order", {
      p_payload: {
        items,
        contactName: name.trim(),
        contactPhone: phone.trim(),
        contactEmail: email.trim(),
        deliveryZoneId: cart.requiresShipping && zoneId ? zoneId : null,
        shippingAddress: address.trim() || null,
        shippingBarangay: barangay.trim() || null,
        shippingCity: city.trim() || null,
        shippingProvince: province.trim() || null,
        shippingPostalCode: postalCode.trim() || null,
        customerNotes: notes.trim() || null,
      },
      p_actor: session.user.id,
      p_idempotency_key: walletKey,
    });

    setWalletBusy(false);

    if (error) {
      // The message the database refused with is the useful one: a shortfall, an
      // unfinalised delivery fee, or a restricted account.
      const message = error.message.replace(/^[A-Z_]+:\s*/, "");
      console.error("Shopping Wallet payment failed:", error.message);
      setWalletError(message);
      await wallet.reload();
      return;
    }

    const placed = (data ?? {}) as unknown as PlacedOrder;
    if (placed.status !== "PAID" && placed.status !== "DUPLICATE") {
      setWalletError(placed.reasonText ?? "The Shopping Wallet payment could not be completed.");
      await wallet.reload();
      return;
    }

    rememberOrderToken(placed.orderNumber ?? "", placed.accessToken ?? "");
    cart.clear();
    setWalletDialogOpen(false);
    await wallet.reload();

    toast({
      title: "Paid with Shopping Wallet",
      description:
        placed.reasonText ??
        `Reference ${placed.reference ?? "\u2014"}. Remaining balance ${formatPeso(placed.walletBalance ?? 0)}.`,
    });
    navigate(`/order/${placed.orderNumber}`, { state: { justPlaced: true } });
  };

  const placeOrder = async () => {
    const problem = validate();
    if (problem) {
      setFailure(problem);
      return;
    }
    setFailure(null);

    // The Shopping Wallet is settled after an explicit confirmation, so the member
    // sees the order total and what the balance will be before any money moves.
    if (isWalletPayment) {
      setWalletError(null);
      setWalletKey(crypto.randomUUID());
      setWalletDialogOpen(true);
      return;
    }

    setSubmitting(true);

    // 1. The order is created and priced server-side, and stock is reserved
    //    inside that same transaction.
    const { data, error } = await supabase.rpc("kmd_checkout_place_order", {
      p_payload: {
        items,
        contactName: name.trim(),
        contactPhone: phone.trim(),
        contactEmail: email.trim(),
        deliveryZoneId: cart.requiresShipping && zoneId ? zoneId : null,
        shippingAddress: address.trim() || null,
        shippingBarangay: barangay.trim() || null,
        shippingCity: city.trim() || null,
        shippingProvince: province.trim() || null,
        shippingPostalCode: postalCode.trim() || null,
        paymentMethod,
        customerNotes: notes.trim() || null,
      },
    });

    if (error) {
      console.error("Order placement failed:", error.message);
      setSubmitting(false);
      setFailure("We could not place your order just now. Please try again.");
      return;
    }

    const placed = (data ?? {}) as unknown as PlacedOrder;
    if (placed.status !== "CREATED" || !placed.orderNumber) {
      setSubmitting(false);
      setFailure(placed.reasonText ?? "Your order could not be placed.");
      return;
    }

    rememberOrderToken(placed.orderNumber, placed.accessToken ?? "");

    // 2. Attach the proof. If this fails the order still exists, so the customer
    //    is sent to the confirmation page to attach it there rather than losing
    //    the order.
    const path = proofState.proof
      ? await uploadProof(placed.orderNumber, proofState.proof.file)
      : null;

    if (path) {
      const { data: proofData, error: proofError } = await supabase.rpc(
        "kmd_checkout_submit_proof",
        {
          p_payload: {
            orderNumber: placed.orderNumber,
            accessToken: placed.accessToken,
            method: paymentMethod,
            proofPath: path,
            amount: placed.totalAmount ?? null,
            contact: email.trim(),
          },
        },
      );

      if (proofError || (proofData as { status?: string } | null)?.status === "FAILED") {
        console.error("Proof submission failed:", proofError?.message);
        toast({
          title: "Order placed, receipt not attached",
          description:
            "We saved your order but could not attach the receipt. You can attach it on the next page.",
          variant: "destructive",
        });
      }
    }

    cart.clear();
    setSubmitting(false);
    navigate(`/order/${placed.orderNumber}`, { state: { justPlaced: true } });
  };

  if (cart.lines.length === 0) {
    return (
      <SiteShell>
        <PageHero eyebrow="Checkout" title="Your cart is empty" />
        <Section>
          <EmptyState
            icon={ShoppingBag}
            title="There is nothing to check out"
            description="Add a product to your cart and come back to complete your order."
            action={
              <Button asChild variant="brand">
                <Link to="/shop">Shop all products</Link>
              </Button>
            }
          />
        </Section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Checkout"
        title="Almost done"
        intro="No account is needed. We only ask for what we need to deliver your order and verify your payment."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-6">
            {/* ---- contact ---- */}
            <section className="kmd-panel p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="h-4 w-4 text-primary" />
                Your details
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {session
                  ? "Signed in — we have filled in what we already have. Change anything that is different."
                  : "You can order as a guest. Registering later is optional."}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="checkout-name">Full name</Label>
                  <Input
                    id="checkout-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-1.5"
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div>
                  <Label htmlFor="checkout-phone">Mobile number</Label>
                  <Input
                    id="checkout-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-1.5"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="checkout-email">Email address</Label>
                  <Input
                    id="checkout-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1.5"
                    placeholder="you@example.com"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Your order confirmation and tracking link go here.
                  </p>
                </div>
              </div>
            </section>

            {/* ---- delivery ---- */}
            {cart.requiresShipping ? (
              <section className="kmd-panel p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />
                  Delivery address
                </h2>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="checkout-zone">Delivery area</Label>
                    <Select value={zoneId} onValueChange={setZoneId}>
                      <SelectTrigger id="checkout-zone" className="mt-1.5">
                        <SelectValue placeholder="Choose your area" />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryZones.map((zone) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                            {zone.isConfigured
                              ? ` — ${formatPeso(zone.shippingFee)}`
                              : " — fee to be confirmed"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="checkout-address">Street address</Label>
                    <Input
                      id="checkout-address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="mt-1.5"
                      placeholder="House or unit number, street, subdivision"
                    />
                  </div>

                  <div>
                    <Label htmlFor="checkout-barangay">Barangay</Label>
                    <Input
                      id="checkout-barangay"
                      value={barangay}
                      onChange={(event) => setBarangay(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkout-city">City or municipality</Label>
                    <Input
                      id="checkout-city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkout-province">Province</Label>
                    <Input
                      id="checkout-province"
                      value={province}
                      onChange={(event) => setProvince(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="checkout-postal">Postal code</Label>
                    <Input
                      id="checkout-postal"
                      value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {shippingPending ? (
                  <div className="mt-4 flex gap-2 rounded-lg border border-warning/35 bg-warning/10 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <p className="text-[11px] leading-relaxed text-foreground/85">
                      The delivery fee for this area has not been published yet, so your order will be
                      recorded as <strong>shipping quote pending</strong>. We will confirm the fee with
                      you before dispatch and nothing extra is charged without your agreement.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="kmd-panel flex gap-3 p-5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your cart contains only digital services, so there is no delivery fee. We will
                  contact you at the email address above to agree the scope once payment is verified.
                </p>
              </section>
            )}

            {/* ---- payment ---- */}
            <section className="kmd-panel p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Lock className="h-4 w-4 text-primary" />
                Payment options
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose how you will pay. Paying from your Shopping Wallet is settled instantly;
                anything else needs the exact amount sent and a receipt attached.
              </p>

              <div className="mt-5 space-y-4">
                <WalletPaymentOption
                  signedIn={Boolean(session)}
                  balance={wallet.balance}
                  balanceLoading={wallet.loading}
                  total={orderTotal}
                  totalFinal={totalFinal}
                  selected={isWalletPayment}
                  onSelect={() => setPaymentMethod(WALLET_METHOD)}
                />

                <PaymentDetails
                  accounts={paymentAccounts}
                  selectedMethod={paymentMethod}
                  onSelect={setPaymentMethod}
                />
              </div>

              {noPaymentAccount ? (
                <div className="mt-5 rounded-lg border border-warning/35 bg-warning/10 p-3">
                  <p className="text-[11px] leading-relaxed text-foreground/85">
                    No payment account has been verified yet, so we cannot take a transfer payment
                    right now. Please contact us and we will complete the order with you directly.
                  </p>
                </div>
              ) : null}

              {isWalletPayment ? (
                <div className="mt-6 flex gap-2 rounded-lg border border-gold/40 bg-gold/8 p-3">
                  <ShoppingBag className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <p className="text-[11px] leading-relaxed text-foreground/85">
                    Nothing to upload: your Shopping Wallet is charged the order total when you
                    confirm, and the order is marked paid in the same step.
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <p className="kmd-eyebrow text-muted-foreground">Proof of payment</p>
                  <div className="mt-2">
                    <ProofPicker proofState={proofState} />
                  </div>
                </div>
              )}

              <div className="mt-6">
                <Label htmlFor="checkout-notes">Notes for our team (optional)</Label>
                <Textarea
                  id="checkout-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-1.5"
                  placeholder="Landmark, preferred delivery window, or anything we should know."
                />
              </div>
            </section>
          </div>

          {/* ---- summary ---- */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="kmd-panel p-5">
              <p className="text-sm font-semibold">Order summary</p>

              <ul className="mt-4 space-y-3">
                {(quote?.lines ?? []).map((line) => (
                  <li key={line.sku} className="flex gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-secondary">
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt=""
                          crossOrigin="anonymous"
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{line.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {line.quantity} × {formatPeso(line.unitPrice)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-bold tabular-nums">
                      {formatPeso(line.lineTotal)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-medium tabular-nums">
                    {formatPeso(quote?.subtotal ?? cart.subtotal)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd className="tabular-nums">
                    {!cart.requiresShipping ? (
                      <span className="text-xs text-muted-foreground">Not applicable</span>
                    ) : quote?.shippingQuoted ? (
                      formatPeso(quote.shippingFee ?? 0)
                    ) : (
                      <span className="text-xs font-semibold text-warning">Quote pending</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <dt className="font-semibold">Total due</dt>
                  <dd className="text-lg font-extrabold tabular-nums">
                    {formatPeso(quote?.total ?? cart.subtotal)}
                  </dd>
                </div>
              </dl>

              {quoteError ? (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                  {quoteError}
                </p>
              ) : null}

              {quoting ? (
                <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Pricing your cart…
                </p>
              ) : null}

              <label className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link to="/terms" className="text-accent underline underline-offset-2">
                    terms and conditions
                  </Link>{" "}
                  and the{" "}
                  <Link to="/privacy-policy" className="text-accent underline underline-offset-2">
                    privacy policy
                  </Link>
                  , and I confirm the payment details I attach are genuine.
                </span>
              </label>

              {failure ? (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-[11px] text-destructive">
                  {failure}
                </p>
              ) : null}

              <Button
                type="button"
                variant="brand"
                size="lg"
                className="mt-4 w-full"
                disabled={submitting || (noPaymentAccount && !isWalletPayment)}
                onClick={() => void placeOrder()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Placing your order…
                  </>
                ) : isWalletPayment ? (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    Pay with Shopping Wallet
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-4 w-4" />
                    Place order
                  </>
                )}
              </Button>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {isWalletPayment
                  ? `You will be asked to confirm ${formatPeso(orderTotal)} before your Shopping Wallet is charged.`
                  : `You will pay ${paymentMethod ? methodLabel(paymentMethod) : "the method you choose"} to the account shown above. Your order is confirmed once our team verifies the receipt.`}
              </p>
            </div>
          </aside>
        </div>
      </Section>

      <Dialog
        open={walletDialogOpen}
        onOpenChange={(open) => {
          if (walletBusy) return;
          setWalletDialogOpen(open);
          if (!open) setWalletError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Shopping Wallet payment</DialogTitle>
            <DialogDescription>
              The order total is deducted from your wallet and your order is marked paid in one
              step. Nothing is charged unless the whole payment succeeds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <WalletPaymentSummary total={orderTotal} balance={wallet.balance} />

            {wallet.balance < orderTotal ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-[11px] font-semibold text-destructive">
                  Short by {formatPeso(orderTotal - wallet.balance)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Your bag is kept. Convert Unilevel Points into your Shopping Wallet, then come back
                  and confirm.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link to="/app/shopping-wallet" target="_blank" rel="noreferrer">
                    Convert Points to Shopping Wallet
                  </Link>
                </Button>
              </div>
            ) : null}

            {walletError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-medium text-destructive">
                {walletError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWalletDialogOpen(false)}
              disabled={walletBusy}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void payWithWallet()}
              disabled={walletBusy || !session || wallet.balance < orderTotal}
            >
              {walletBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
              Confirm and pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SiteShell>
  );
}
