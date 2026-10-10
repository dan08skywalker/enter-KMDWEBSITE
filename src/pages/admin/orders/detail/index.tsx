import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, BadgeCheck, Loader2, RefreshCw, Truck, Undo2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/kmd/status-badge";
import { EmptyState } from "@/components/kmd/empty-state";
import { OrderStatusTimeline } from "@/components/kmd/order-status-timeline";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { EngineResultPanel } from "@/components/kmd/engine-result";
import { MemberCell } from "@/components/kmd/member-cell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime, formatPeso, formatPoints } from "@/lib/kmd/format";
import { ledgerStatus, orderStatus, paymentMethod, transactionType, walletPaymentStatus } from "@/lib/kmd/labels";
import type {
  EngineRunResult,
  LoyaltyLedgerRow,
  Order,
  OrderItem,
  PaymentProof,
  PointLedgerRow,
  Profile,
  WalletPayment,
} from "@/lib/kmd/types";

export default function AdminOrderDetail() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  /** Authoritative reward status for this order, derived from the ledgers. */
  const [derivedRewardStatus, setDerivedRewardStatus] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [walletPayment, setWalletPayment] = useState<WalletPayment | null>(null);
  const [ledgerRows, setLedgerRows] = useState<PointLedgerRow[]>([]);
  const [loyaltyRows, setLoyaltyRows] = useState<LoyaltyLedgerRow[]>([]);
  const [buyer, setBuyer] = useState<Profile | null>(null);
  const [engineResult, setEngineResult] = useState<EngineRunResult | null>(null);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [fulfillmentStatus, setFulfillmentStatus] = useState("unfulfilled");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [fulfillmentBusy, setFulfillmentBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);

    const [orderResult, itemResult, proofResult, ledgerResult, loyaltyResult, walletResult] =
      await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("payment_proofs").select("*").eq("order_id", orderId).order("submitted_at", { ascending: false }),
        supabase.from("point_ledger").select("*").eq("order_id", orderId).order("unilevel_level", { ascending: true }),
        supabase.from("loyalty_credit_ledger").select("*").eq("order_id", orderId),
        supabase.from("wallet_payments").select("*").eq("order_id", orderId).maybeSingle(),
      ]);

    if (orderResult.error) console.error("Could not load the order:", orderResult.error.message);
    if (walletResult.error) console.error("Could not load the wallet payment:", walletResult.error.message);

    const found = (orderResult.data as unknown as Order | null) ?? null;
    setOrder(found);
    setItems((itemResult.data ?? []) as unknown as OrderItem[]);
    setProofs((proofResult.data ?? []) as unknown as PaymentProof[]);
    setLedgerRows((ledgerResult.data ?? []) as unknown as PointLedgerRow[]);
    setLoyaltyRows((loyaltyResult.data ?? []) as unknown as LoyaltyLedgerRow[]);
    setWalletPayment((walletResult.data as unknown as WalletPayment | null) ?? null);

    if (found) {
      const { data: buyerRow, error: buyerError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", found.buyer_profile_id)
        .maybeSingle();
      if (buyerError) console.error("Could not load the buyer:", buyerError.message);
      setBuyer((buyerRow as unknown as Profile | null) ?? null);
    }

    // Authoritative reward status for this order, from the same backend source the
    // approval screen uses.
    const statusOutcome = await invokeFunction<{ result?: Record<string, { status?: string }> }>(
      "admin-actions",
      { action: "reward_status", orderIds: [orderId] },
    );
    setDerivedRewardStatus(
      statusOutcome.ok ? (statusOutcome.data?.result?.[orderId]?.status ?? null) : null,
    );

    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (action: string, extra: Record<string, unknown>, successMessage: string) => {
    const outcome = await invokeFunction<{ ok?: boolean; result?: EngineRunResult & Record<string, unknown> }>(
      "admin-actions",
      { action, orderId, ...extra },
    );

    if (!outcome.ok) {
      toast.error("Action failed", { description: outcome.error });
      return { error: outcome.error ?? "Action failed" };
    }

    const result = outcome.data?.result ?? null;
    if (result && typeof result.status === "string") {
      setEngineResult(result as EngineRunResult);
    }

    if (result?.status === "FAILED" || result?.status === "NOT_QUALIFIED") {
      // Refusals arrive inside a successful HTTP response; reporting success here
      // would tell the administrator the payment went through when it did not.
      toast.error(successMessage + " did not complete", {
        description: result.reasonText ?? "The backend refused the action.",
      });
    } else if (result?.status === "ALREADY_PROCESSED") {
      // Nothing is credited again, and the wording matches what both screens show.
      toast.info("Rewards already processed for this order.", {
        description: result.reasonText ?? "No points, commissions or loyalty credits were added again.",
      });
    } else {
      toast.success(successMessage);
    }
    await load();
    return {};
  };

  const viewProof = async () => {
    const outcome = await invokeFunction<{ url?: string }>("admin-actions", {
      action: "proof_url",
      orderId,
    });
    if (!outcome.ok || !outcome.data?.url) {
      toast.error("Could not open the payment proof", { description: outcome.error });
      return;
    }
    window.open(outcome.data.url, "_blank", "noopener,noreferrer");
  };

  const reverseRow = async (ledgerId: string, reason?: string) => {
    const outcome = await invokeFunction("admin-actions", {
      action: "reverse_reward",
      ledgerId,
      reason,
    });
    if (!outcome.ok) {
      toast.error("Could not reverse the reward", { description: outcome.error });
      return { error: outcome.error };
    }
    toast.success("Reversal posted as a new ledger entry");
    await load();
    return {};
  };

  const openFulfillment = (current: Record<string, unknown>) => {
    setFulfillmentStatus(String(current.fulfillment_status ?? "unfulfilled"));
    setCourier(String(current.courier ?? ""));
    setTrackingNumber(String(current.tracking_number ?? ""));
    setFulfillmentOpen(true);
  };

  const saveFulfillment = async () => {
    setFulfillmentBusy(true);
    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "set_fulfillment",
      orderId,
      status: fulfillmentStatus,
      courier: courier.trim() || null,
      trackingNumber: trackingNumber.trim() || null,
    });
    setFulfillmentBusy(false);

    if (!outcome.ok) {
      toast.error("Could not update fulfilment", { description: outcome.error });
      return;
    }
    toast.success(outcome.data?.reasonText ?? "Fulfilment updated");
    setFulfillmentOpen(false);
    await load();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Order" description="Loading the purchase record" />
        <div className="kmd-panel h-40 animate-pulse" />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" />
        <div className="kmd-panel">
          <EmptyState
            icon={BadgeCheck}
            title="Order unavailable"
            description="The order ID does not match a purchase record."
            action={
              <Button asChild>
                <Link to="/admin/orders">Back to orders</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const status = orderStatus(order.status);
  const latestProof = proofs[0];
  const row = order as unknown as Record<string, unknown>;
  const fulfillment = String(row.fulfillment_status ?? "unfulfilled");
  const orderCourier = (row.courier ?? null) as string | null;
  const orderTracking = (row.tracking_number ?? null) as string | null;
  const shippingQuoted = row.is_shipping_quoted !== false;
  const shippingFee = Number(row.shipping_fee ?? 0);

  return (
    <>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Created ${formatDate(order.created_at)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/admin/orders")}>
              Back to orders
            </Button>
            <Button variant="outline" asChild>
              <Link to="/admin/diagnostics">
                <Activity className="h-4 w-4" />
                Diagnostics
              </Link>
            </Button>
            <Button variant="brand" onClick={() => openFulfillment(order as unknown as Record<string, unknown>)}>
              <Truck className="h-4 w-4" />
              Fulfilment
            </Button>
          </>
        }
      />

      <div className="kmd-panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="kmd-label">Fulfilment</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold capitalize">
              <Truck className="h-4 w-4 text-primary" />
              {fulfillment.replace(/_/g, " ")}
            </p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <p className="kmd-label">Courier</p>
            <p className="mt-1 text-sm font-semibold">{orderCourier ?? "Not assigned"}</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <p className="kmd-label">Tracking number</p>
            <p className="mt-1 font-mono text-sm font-semibold">{orderTracking ?? "Not issued"}</p>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <div>
            <p className="kmd-label">Delivery charge</p>
            <p className="mt-1 text-sm font-semibold">
              {shippingQuoted ? formatPeso(shippingFee) : "Shipping quote pending"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => openFulfillment(row)}>
          Update fulfilment
        </Button>
      </div>

      <div className="kmd-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          {buyer ? <MemberCell profile={buyer} showStatus /> : <span className="text-sm">{order.buyer_member_code}</span>}
          <Separator orientation="vertical" className="h-8" />
          <div>
            <p className="kmd-label">Order total</p>
            <p className="text-lg font-bold">{formatPeso(order.total_amount)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={status.label} tone={status.tone} />
          <StatusBadge
            label={
              derivedRewardStatus === "partial"
                ? "Rewards partially processed"
                : derivedRewardStatus === "complete" || derivedRewardStatus === "historical" || order.rewards_processed
                  ? "Rewards processed"
                  : "Rewards not processed"
            }
            tone={
              derivedRewardStatus === "partial"
                ? "warning"
                : derivedRewardStatus === "complete" || derivedRewardStatus === "historical" || order.rewards_processed
                  ? "success"
                  : "warning"
            }
          />
          {order.is_test ? <StatusBadge label="Test" tone="platinum" /> : null}
        </div>
      </div>

      <div className="kmd-panel p-5">
        <h2 className="mb-4 text-sm font-semibold">Verification progress</h2>
        <OrderStatusTimeline
          status={order.status}
          rewardsProcessed={order.rewards_processed}
          rewardsProcessedAt={order.rewards_processed_at}
        />
      </div>

      <div className="kmd-panel p-5">
        <h2 className="text-sm font-semibold">Administrator actions</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Confirming payment triggers the reward engine exactly once for Levels 1 to 5. Repeating it
          cannot pay a level twice, and the engine writes a ledger entry only for levels whose value is
          configured above zero.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ConfirmActionDialog
            trigger={
              <Button>
                <BadgeCheck className="h-4 w-4" />
                Confirm payment
              </Button>
            }
            title="Confirm this payment?"
            description="This runs the reward engine once for this order: it traces Level 1 to Level 5, calculates each configured bonus and posts the ledger entries. A second confirmation returns 'already processed' and pays nothing extra."
            confirmLabel="Confirm payment and run the engine"
            reasonRequired
            reasonLabel="Reason for confirming"
            onConfirm={(reason) => runAction("confirm_payment", { reason }, "Payment confirmed")}
          />

          <ConfirmActionDialog
            trigger={
              <Button variant="outline">
                <RefreshCw className="h-4 w-4" />
                Mark under review
              </Button>
            }
            title="Move this order to under review?"
            description="The order stays unqualified, so no rewards are generated."
            confirmLabel="Mark under review"
            reasonRequired
            onConfirm={(reason) =>
              runAction("set_order_status", { status: "under_review", reason }, "Order marked under review")
            }
          />

          {order.status === "confirmed" &&
          !order.rewards_processed &&
          derivedRewardStatus !== "complete" &&
          derivedRewardStatus !== "historical" ? (
            <ConfirmActionDialog
              trigger={
                <Button variant="secondary">
                  <RefreshCw className="h-4 w-4" />
                  Retry reward processing
                </Button>
              }
              title="Retry reward processing?"
              description="Use this when the order is confirmed but no ledger entries exist, for example after a configuration problem was fixed."
              confirmLabel="Retry now"
              reasonRequired
              onConfirm={(reason) =>
                runAction("process_qualified_purchase", { reason }, "Reward processing retried")
              }
            />
          ) : null}

          <ConfirmActionDialog
            trigger={
              <Button variant="outline" className="text-destructive">
                <XCircle className="h-4 w-4" />
                Reject payment
              </Button>
            }
            title="Reject this payment?"
            description="The order is closed as rejected. Rewards are never generated for a rejected order."
            confirmLabel="Reject payment"
            destructive
            reasonRequired
            onConfirm={(reason) => runAction("reject_payment", { reason }, "Payment rejected")}
          />

          {!["confirmed", "rejected", "cancelled"].includes(order.status) ? (
            <ConfirmActionDialog
              trigger={<Button variant="ghost">Cancel order</Button>}
              title="Cancel this order?"
              description="The order is closed and stops accepting payment proof."
              confirmLabel="Cancel order"
              destructive
              reasonRequired
              onConfirm={(reason) => runAction("set_order_status", { status: "cancelled", reason }, "Order cancelled")}
            />
          ) : null}
        </div>
      </div>

      <div className="kmd-panel overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Order items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Product identity is stored on the order as Product ID + SKU, so commissions never depend on
            a product name.
          </p>
        </div>
        <div className="overflow-x-auto kmd-scroll">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {["Item ID", "Product ID", "SKU", "Product", "Qty", "Unit price", "Line total"].map((header) => (
                  <TableHead key={header} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-[11px]">{item.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-[11px]">{item.product_id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-sm">{item.product_name}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatPeso(item.unit_price)}</TableCell>
                  <TableCell className="text-right font-medium">{formatPeso(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {walletPayment ? (
          <div className="kmd-panel p-5 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Shopping Wallet payment</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This order was settled from the member's Shopping Wallet in one transaction, so
                  there is no proof to verify. Refunds are issued from Wallet Payments.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/wallet-payments">
                  <Wallet className="h-3.5 w-3.5" />
                  Open Wallet Payments
                </Link>
              </Button>
            </div>

            <dl className="mt-4 grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-semibold">Shopping Wallet</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="font-mono">{walletPayment.reference}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Date and time</dt>
                <dd>{formatDateTime(walletPayment.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Amount deducted</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(walletPayment.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Balance before</dt>
                <dd className="tabular-nums">{formatPeso(walletPayment.wallet_balance_before)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Balance after</dt>
                <dd className="font-semibold tabular-nums">
                  {formatPeso(walletPayment.wallet_balance_after)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Refunded</dt>
                <dd className="tabular-nums">{formatPeso(walletPayment.refunded_amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {(() => {
                    const descriptor = walletPaymentStatus(walletPayment.status);
                    return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
                  })()}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}

        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Payment proofs</h2>
          {proofs.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No payment proof has been submitted.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {latestProof ? (
                <div className="rounded-lg border p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge
                      label={paymentMethod(latestProof.method).label}
                      tone={paymentMethod(latestProof.method).tone}
                    />
                    <span className="text-muted-foreground">{formatDateTime(latestProof.submitted_at)}</span>
                  </div>
                  <dl className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Reference</dt>
                      <dd className="font-mono">{latestProof.reference_number ?? "\u2014"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Amount declared</dt>
                      <dd>{formatPeso(latestProof.amount)}</dd>
                    </div>
                    {latestProof.bank_name ? (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Bank</dt>
                        <dd>{latestProof.bank_name}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => void viewProof()}
                    disabled={!latestProof.proof_path}
                  >
                    {latestProof.proof_path ? "View proof file" : "No file attached"}
                  </Button>
                </div>
              ) : null}
              {proofs.length > 1 ? (
                <p className="text-[11px] text-muted-foreground">
                  {proofs.length - 1} earlier submission{proofs.length - 1 > 1 ? "s" : ""} also recorded.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Reward outcome</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ledger entries written by the reward engine for this order.
          </p>

          {ledgerRows.length === 0 && loyaltyRows.length === 0 ? (
            <EmptyState
              icon={BadgeCheck}
              title="No ledger entries yet"
              description={
                order.status === "confirmed"
                  ? order.rewards_processed
                    ? "The engine ran but every eligible level is configured at 0, so no row was created."
                    : "Reward processing has not completed. Use the retry action above."
                  : "No commission is generated until payment is confirmed."
              }
            />
          ) : (
            <div className="mt-3 space-y-4">
              {ledgerRows.length > 0 ? (
                <div className="overflow-x-auto kmd-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        {["Level", "Beneficiary", "SKU", "Qty", "Per unit", "Points", "Status", ""].map((header) => (
                          <TableHead key={header} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-semibold">
                            {row.unilevel_level ? `L${row.unilevel_level}` : "\u2014"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{row.beneficiary_member_code}</TableCell>
                          <TableCell className="font-mono text-xs">{row.sku ?? "\u2014"}</TableCell>
                          <TableCell className="text-right">{row.quantity ?? "\u2014"}</TableCell>
                          <TableCell className="text-right">{formatPoints(row.points_per_unit)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatPoints(row.total_points)}</TableCell>
                          <TableCell>
                            <StatusBadge
                              label={ledgerStatus(row.status).label}
                              tone={ledgerStatus(row.status).tone}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {row.transaction_type !== "REVERSAL" && row.status === "posted" ? (
                              <ConfirmActionDialog
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    <Undo2 className="h-3.5 w-3.5" />
                                    Reverse
                                  </Button>
                                }
                                title={`Reverse ${row.transaction_id}?`}
                                description="The ledger row is never edited. An offsetting REVERSAL entry is written instead, and the beneficiary's balance is reduced accordingly."
                                confirmLabel="Post reversal"
                                destructive
                                reasonRequired
                                onConfirm={(reason) => reverseRow(row.id, reason)}
                              />
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {loyaltyRows.length > 0 ? (
                <div className="rounded-lg border px-3 py-2">
                  <p className="kmd-label">Loyalty credit ledger (separate)</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {loyaltyRows.map((row) => (
                      <li key={row.id} className="flex items-center justify-between">
                        <span className="font-mono">{row.beneficiary_member_code}</span>
                        <span className="font-semibold tabular-nums">{formatPoints(row.credit_amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {ledgerRows.length > 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {ledgerRows.length} ledger row{ledgerRows.length > 1 ? "s" : ""} &middot; transaction types:{" "}
              {Array.from(new Set(ledgerRows.map((row) => transactionType(row.transaction_type).label))).join(", ")}
            </p>
          ) : null}
        </div>
      </div>

      <Dialog open={engineResult !== null} onOpenChange={(open) => !open && setEngineResult(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Reward engine result</DialogTitle>
            <DialogDescription>
              Exactly what the backend returned for order {order.order_number}.
            </DialogDescription>
          </DialogHeader>
          {engineResult ? <EngineResultPanel result={engineResult} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={fulfillmentOpen} onOpenChange={setFulfillmentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fulfilment</DialogTitle>
            <DialogDescription>
              Moving this order to shipped records the dispatch time and notifies the customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="fulfillment-status">Status</Label>
              <Select value={fulfillmentStatus} onValueChange={setFulfillmentStatus}>
                <SelectTrigger id="fulfillment-status" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="fulfillment-courier">Courier</Label>
                <Input
                  id="fulfillment-courier"
                  value={courier}
                  onChange={(event) => setCourier(event.target.value)}
                  className="mt-1.5"
                  placeholder="Courier name"
                />
              </div>
              <div>
                <Label htmlFor="fulfillment-tracking">Tracking number</Label>
                <Input
                  id="fulfillment-tracking"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  className="mt-1.5"
                  placeholder="Tracking reference"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFulfillmentOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" disabled={fulfillmentBusy} onClick={() => void saveFulfillment()}>
              {fulfillmentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save fulfilment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
