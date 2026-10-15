import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { MemberCell } from "@/components/kmd/member-cell";
import { StatusBadge } from "@/components/kmd/status-badge";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { formatDateTime, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { accountStatus, orderStatus, paymentMethod } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow, OrderItem, PointLedgerRow } from "@/lib/kmd/types";
import { approvalBucket, approvalDescriptor, approvalState, buyerLabel, type ApprovalRow } from "./approval";

interface PaymentDetailsDialogProps {
  row: ApprovalRow | null;
  /** Payment decisions are reserved for a super administrator. */
  canDecide: boolean;
  onClose: () => void;
  onApprove: (row: ApprovalRow) => Promise<{ error?: string } | void>;
  onReject: (row: ApprovalRow) => Promise<{ error?: string } | void>;
  onMarkUnderReview: (row: ApprovalRow) => Promise<{ error?: string } | void>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="kmd-label">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value ?? "\u2014"}</p>
    </div>
  );
}

/**
 * Everything an approver needs to decide on one payment: who paid, what they
 * bought, the proof they uploaded, which rewards the approval posted, and the
 * approve / reject controls for that specific payment.
 */
export function PaymentDetailsDialog({
  row,
  canDecide,
  onClose,
  onApprove,
  onReject,
  onMarkUnderReview,
}: PaymentDetailsDialogProps) {
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofState, setProofState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [points, setPoints] = useState<PointLedgerRow[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyLedgerRow[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);

  const orderId = row?.order.id ?? null;
  const proofPath = row?.proof?.proof_path ?? null;

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setProofUrl(null);
    setProofState(proofPath ? "loading" : "idle");

    if (proofPath) {
      void invokeFunction<{ url?: string }>("admin-actions", { action: "proof_url", orderId }).then(
        (outcome) => {
          if (cancelled) return;
          if (outcome.ok && outcome.data?.url) {
            setProofUrl(outcome.data.url);
            setProofState("ready");
          } else {
            setProofState("unavailable");
          }
        },
      );
    }

    setLoadingRewards(true);
    void Promise.all([
      supabase.from("point_ledger").select("*").eq("order_id", orderId).order("unilevel_level"),
      supabase.from("loyalty_credit_ledger").select("*").eq("order_id", orderId),
    ]).then(([pointResult, loyaltyResult]) => {
      if (cancelled) return;
      if (pointResult.error) console.error("Could not load the reward rows:", pointResult.error.message);
      setPoints((pointResult.data ?? []) as unknown as PointLedgerRow[]);
      setLoyalty((loyaltyResult.data ?? []) as unknown as LoyaltyLedgerRow[]);
      setLoadingRewards(false);
    });

    return () => {
      cancelled = true;
    };
  }, [orderId, proofPath]);

  if (!row) return null;

  const bucket = approvalBucket(row);
  const status = orderStatus(row.order.status);
  const payment = row.proof ? paymentMethod(row.proof.method) : null;
  const paymentState = approvalState(row.proof);
  const account = row.buyer ? accountStatus(row.buyer.account_status) : null;
  const pointsTotal = points.reduce((sum, entry) => sum + toNumber(entry.total_points), 0);
  const loyaltyTotal = loyalty.reduce((sum, entry) => sum + toNumber(entry.credit_amount), 0);

  const browseProof = () => {
    if (!proofUrl) {
      toast.error("The proof file is not available");
      return;
    }
    window.open(proofUrl, "_blank", "noopener,noreferrer");
  };

  const itemColumns: Column<OrderItem>[] = [
    { key: "product", header: "Item", cell: (item) => <span className="text-sm">{item.product_name}</span> },
    {
      key: "sku",
      header: "SKU",
      cell: (item) => <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>,
    },
    { key: "quantity", header: "Qty", cell: (item) => String(item.quantity), className: "text-right" },
    { key: "price", header: "Unit price", cell: (item) => formatPeso(item.unit_price), className: "text-right" },
    {
      key: "total",
      header: "Line total",
      cell: (item) => <span className="font-semibold">{formatPeso(item.line_total)}</span>,
      className: "text-right",
    },
  ];

  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto kmd-scroll">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="font-mono">{row.order.order_number}</DialogTitle>
            <StatusBadge label={approvalDescriptor(row).label} tone={approvalDescriptor(row).tone} />
            <StatusBadge label={status.label} tone={status.tone} />
            {row.order.is_test ? <StatusBadge label="Test" tone="platinum" /> : null}
          </div>
          <DialogDescription>
            Submitted payment for {buyerLabel(row)} &middot; declared{" "}
            {formatPeso(row.proof?.amount ?? row.order.total_amount)}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            Member
          </h3>
          {row.buyer ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <MemberCell profile={row.buyer} showStatus />
                <StatusBadge label={account?.label ?? "\u2014"} tone={account?.tone ?? "neutral"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Username" value={row.buyer.username} />
                <Field label="Email" value={row.buyer.email} />
                <Field label="Mobile" value={row.buyer.mobile_number ?? "\u2014"} />
                <Field label="Registered" value={formatDateTime(row.buyer.registration_date)} />
                <Field label="Activated" value={formatDateTime(row.buyer.activation_date)} />
                <Field
                  label="Membership"
                  value={row.membershipLabel ?? (row.isMembership ? "Membership package" : "No membership package")}
                />
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Buyer" value={buyerLabel(row)} />
              <Field label="Email" value={row.proof?.guest_email ?? row.order.guest_email ?? "\u2014"} />
              <Field label="Customer type" value={row.order.customer_type} />
            </div>
          )}

          {row.isMembership ? (
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {bucket === "approved"
                ? "This membership payment is approved: the member was activated and the package assigned in the same transaction."
                : "Approving this payment activates the member and assigns the purchased package in the same transaction as the reward engine run."}
            </p>
          ) : null}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Payment
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Payment status" value={<StatusBadge label={paymentState.label} tone={paymentState.tone} />} />
            <Field label="Method" value={payment ? <StatusBadge label={payment.label} tone={payment.tone} /> : "\u2014"} />
            <Field label="Reference number" value={<span className="font-mono">{row.proof?.reference_number ?? "\u2014"}</span>} />
            <Field label="Bank / channel" value={row.proof?.bank_name ?? "\u2014"} />
            <Field label="Account name" value={row.proof?.account_name ?? "\u2014"} />
            <Field label="Declared amount" value={formatPeso(row.proof?.amount ?? row.order.total_amount)} />
            <Field label="Order total" value={formatPeso(row.order.total_amount)} />
            <Field label="Submitted" value={formatDateTime(row.proof?.submitted_at)} />
            <Field label="Reviewed" value={formatDateTime(row.proof?.reviewed_at)} />
          </div>
          {row.proof?.review_notes ? (
            <p className="rounded-lg border px-3 py-2 text-xs">
              <span className="kmd-label">Review note</span>
              <br />
              {row.proof.review_notes}
            </p>
          ) : null}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={browseProof} disabled={!proofUrl}>
                <ExternalLink className="h-3.5 w-3.5" />
                View proof of payment
              </Button>
              {row.proof?.proof_path ? (
                <span className="font-mono text-[11px] text-muted-foreground">{row.proof.proof_path}</span>
              ) : (
                <span className="text-xs text-muted-foreground">No file was uploaded with this submission.</span>
              )}
            </div>

            <div className="mt-3">
              {!row.proof?.proof_path ? null : proofState === "loading" ? (
                <Skeleton className="h-48 w-full" />
              ) : proofState === "ready" && proofUrl ? (
                <img
                  src={proofUrl}
                  crossOrigin="anonymous"
                  alt={`Payment proof for ${row.order.order_number}`}
                  className="max-h-72 w-full rounded-lg border bg-muted object-contain"
                />
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  <ImageOff className="h-4 w-4" />
                  The preview could not be loaded. Use “View proof of payment” to open the file.
                </p>
              )}
            </div>
          </div>
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Purchase</h3>
          <DataTable
            columns={itemColumns}
            rows={row.items}
            rowKey={(item) => item.id}
            loading={false}
            empty={<p className="p-4 text-xs text-muted-foreground">This order has no line items.</p>}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Rewards
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Reward processing"
              value={
                row.order.rewards_processed ? (
                  <span className="text-[hsl(var(--success))]">Processed</span>
                ) : (
                  <span className="text-muted-foreground">Not processed</span>
                )
              }
            />
            <Field label="Processed at" value={formatDateTime(row.order.rewards_processed_at)} />
            <Field label="Qualification source" value={row.order.qualification_source ?? "\u2014"} />
          </div>

          {loadingRewards ? (
            <Skeleton className="h-24 w-full" />
          ) : points.length === 0 && loyalty.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              No ledger entry was posted for this order. While a payment is pending nothing is paid; an approval
              posts the Unilevel and Loyalty entries once.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Unilevel points posted" value={formatPoints(pointsTotal)} />
                <Field label="Loyalty credits posted" value={formatPoints(loyaltyTotal)} />
              </div>
              <ul className="space-y-1 text-xs">
                {points.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1">
                    <span>
                      Level {entry.unilevel_level} &middot; {entry.beneficiary_member_code}{" "}
                      <span className="font-mono text-muted-foreground">{entry.transaction_id}</span>
                    </span>
                    <span className="tabular-nums">{formatPoints(entry.total_points)} points</span>
                  </li>
                ))}
                {loyalty.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1">
                    <span>
                      Loyalty &middot; {entry.beneficiary_member_code}{" "}
                      <span className="font-mono text-muted-foreground">{entry.transaction_id}</span>
                    </span>
                    <span className="tabular-nums">{formatPoints(entry.credit_amount)} credits</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <Separator />

        <section className="flex flex-wrap items-center gap-2">
          {bucket === "approved" ? (
            <>
              <Button size="sm" disabled className="border-success/40 bg-success/12 text-[hsl(var(--success))]">
                <BadgeCheck className="h-3.5 w-3.5" />
                APPROVED
              </Button>
              <span className="text-xs text-muted-foreground">
                This payment is already approved. A second approval would pay nothing extra, so it is disabled.
              </span>
            </>
          ) : bucket === "rejected" ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge label="Rejected" tone="danger" />
              {row.proof?.review_notes ?? "This payment was rejected."}
            </span>
          ) : !canDecide ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldAlert className="h-4 w-4" />
              Only a super administrator can approve or reject a payment.
            </span>
          ) : (
            <>
              <ConfirmActionDialog
                trigger={
                  <Button size="sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve payment
                  </Button>
                }
                title={`Approve the payment for ${row.order.order_number}?`}
                description="This runs the reward engine once for this payment: Level 1 to Level 10 are traced, each configured bonus is calculated and the ledger entries are posted in a single transaction. Confirming a second time returns 'already processed' and pays nothing extra."
                confirmLabel="Approve and run the engine"
                reasonRequired
                reasonLabel="Reason for approving"
                onConfirm={() => onApprove(row)}
              />
              {row.order.status === "proof_submitted" ? (
                <ConfirmActionDialog
                  trigger={
                    <Button size="sm" variant="outline">
                      <Loader2 className="h-3.5 w-3.5" />
                      Mark under review
                    </Button>
                  }
                  title={`Move ${row.order.order_number} to under review?`}
                  description="The order stays unqualified, so no rewards are generated yet."
                  confirmLabel="Mark under review"
                  reasonRequired
                  reasonLabel="Reason"
                  onConfirm={() => onMarkUnderReview(row)}
                />
              ) : null}
              <ConfirmActionDialog
                trigger={
                  <Button size="sm" variant="outline" className="text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    Reject payment
                  </Button>
                }
                title={`Reject the payment for ${row.order.order_number}?`}
                description="The order is closed as rejected, the reserved stock is released and no rewards are ever generated for it. The buyer is notified and can submit a new payment."
                confirmLabel="Reject payment"
                destructive
                reasonRequired
                reasonLabel="Reason for rejection"
                onConfirm={() => onReject(row)}
              />
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
