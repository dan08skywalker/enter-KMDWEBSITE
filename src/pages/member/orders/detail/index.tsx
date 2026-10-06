import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { OrderStatusTimeline } from "@/components/kmd/order-status-timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime, formatPeso } from "@/lib/kmd/format";
import { orderStatus, paymentMethod } from "@/lib/kmd/labels";
import type { Order, OrderItem, PaymentProof, PointLedgerRow } from "@/lib/kmd/types";

const MAX_PROOF_BYTES = 6 * 1024 * 1024;

export default function MemberOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [ownRewards, setOwnRewards] = useState<PointLedgerRow[]>([]);

  const [method, setMethod] = useState("gcash");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [filePayload, setFilePayload] = useState<{ base64: string; contentType: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);

    const [orderResult, itemResult, proofResult, ledgerResult] = await Promise.all([
      supabase.from("orders").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase
        .from("payment_proofs")
        .select("*")
        .eq("order_id", orderId)
        .order("submitted_at", { ascending: false }),
      supabase.from("point_ledger").select("*").eq("order_id", orderId),
    ]);

    if (orderResult.error) console.error("Could not load the order:", orderResult.error.message);
    if (itemResult.error) console.error("Could not load order items:", itemResult.error.message);
    if (proofResult.error) console.error("Could not load payment proofs:", proofResult.error.message);
    if (ledgerResult.error) console.error("Could not load ledger rows:", ledgerResult.error.message);

    setOrder((orderResult.data as unknown as Order | null) ?? null);
    setItems((itemResult.data ?? []) as unknown as OrderItem[]);
    setProofs((proofResult.data ?? []) as unknown as PaymentProof[]);
    setOwnRewards((ledgerResult.data ?? []) as unknown as PointLedgerRow[]);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setFileName(null);
      setFilePayload(null);
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      toast.error("Payment proof must be 6 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setFilePayload({ base64, contentType: file.type || "image/jpeg" });
      setFileName(file.name);
    };
    reader.onerror = () => {
      console.error("Could not read the selected file");
      toast.error("Could not read that file");
    };
    reader.readAsDataURL(file);
  };

  const submitProof = async () => {
    if (!order) return;
    if (method === "bank_transfer" && !bankName.trim()) {
      toast.error("Enter the bank name used for the transfer");
      return;
    }
    if (!reference.trim() && !filePayload) {
      toast.error("Enter a reference number or attach the payment proof");
      return;
    }

    setSubmitting(true);
    const outcome = await invokeFunction<{ ok?: boolean; message?: string }>("member-actions", {
      action: "submit_proof",
      orderId: order.id,
      method,
      referenceNumber: reference || undefined,
      bankName: bankName || undefined,
      accountName: accountName || undefined,
      amount: Number(amount) || 0,
      proofBase64: filePayload?.base64,
      contentType: filePayload?.contentType,
    });
    setSubmitting(false);

    if (!outcome.ok) {
      toast.error("Could not submit the payment proof", { description: outcome.error });
      return;
    }

    toast.success("Payment proof submitted", {
      description: "An administrator will verify it. No commission is generated until payment is confirmed.",
    });
    setReference("");
    setAmount("");
    setFileName(null);
    setFilePayload(null);
    await load();
  };

  const viewProof = async () => {
    if (!order) return;
    const outcome = await invokeFunction<{ url?: string }>("member-actions", {
      action: "proof_url",
      orderId: order.id,
    });
    if (!outcome.ok || !outcome.data?.url) {
      toast.error("Could not open the proof", { description: outcome.error });
      return;
    }
    window.open(outcome.data.url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Order" description="Loading the purchase record" />
        <div className="kmd-panel space-y-4 p-6">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 w-full" />
          ))}
        </div>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" description="This order does not exist or is not yours." />
        <div className="kmd-panel">
          <EmptyState
            icon={FileText}
            title="Order unavailable"
            description="Only your own orders can be opened here."
            action={
              <Button asChild>
                <Link to="/app/orders">Back to my orders</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  const status = orderStatus(order.status);
  const canSubmitProof = !["confirmed", "cancelled", "rejected"].includes(order.status);

  return (
    <>
      <PageHeader
        title={`Order ${order.order_number}`}
        description={`Placed ${formatDate(order.created_at)}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/app/orders">
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </Link>
          </Button>
        }
      />

      <div className="kmd-panel flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="kmd-label">Order total</p>
          <p className="kmd-figure mt-1">{formatPeso(order.total_amount)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={status.label} tone={status.tone} />
          <StatusBadge
            label={order.rewards_processed ? "Rewards processed" : "Rewards not processed"}
            tone={order.rewards_processed ? "success" : "neutral"}
          />
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

      <div className="kmd-panel overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">Order items</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each line stores the Product ID, SKU and quantity, which is what the reward engine uses.
          </p>
        </div>
        <div className="overflow-x-auto kmd-scroll">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Product</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">SKU</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Qty</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Unit price</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.product_name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatPeso(item.unit_price)}</TableCell>
                  <TableCell className="text-right font-medium">{formatPeso(item.line_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Payment proof</h2>
          {canSubmitProof ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Submit your proof of payment. The order then waits for an administrator to verify it.
              </p>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proof-method">Payment method</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="proof-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {method === "bank_transfer" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="proof-bank">Bank name</Label>
                      <Input
                        id="proof-bank"
                        value={bankName}
                        onChange={(event) => setBankName(event.target.value)}
                        placeholder="BDO, BPI, UnionBank ..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proof-account">Account name</Label>
                      <Input
                        id="proof-account"
                        value={accountName}
                        onChange={(event) => setAccountName(event.target.value)}
                      />
                    </div>
                  </>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="proof-reference">Reference number</Label>
                  <Input
                    id="proof-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Reference or transaction number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proof-amount">Amount paid</Label>
                  <Input
                    id="proof-amount"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="proof-file">Attach proof (image or PDF, max 6 MB)</Label>
                  <Input
                    id="proof-file"
                    type="file"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                  />
                  {fileName ? (
                    <p className="text-xs text-muted-foreground">Selected: {fileName}</p>
                  ) : null}
                </div>

                <Button onClick={() => void submitProof()} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Submit payment proof
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              This order no longer accepts payment proof because it is {status.label.toLowerCase()}.
            </p>
          )}

          <div className="mt-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Submitted proofs
            </h3>
            {proofs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No payment proof submitted yet.</p>
            ) : (
              <ul className="space-y-2">
                {proofs.map((proof) => {
                  const methodDescriptor = paymentMethod(proof.method);
                  return (
                    <li key={proof.id} className="rounded-lg border px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <StatusBadge label={methodDescriptor.label} tone={methodDescriptor.tone} />
                          <span className="text-muted-foreground">
                            {formatDateTime(proof.submitted_at)}
                          </span>
                        </span>
                        <span className="font-mono">{proof.reference_number ?? "\u2014"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Amount {formatPeso(proof.amount)}
                        </span>
                        {proof.proof_path ? (
                          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void viewProof()}>
                            View file
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">No file attached</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Reward outcome</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A qualified purchase distributes bonuses to your sponsor chain (Level 1 to Level 5) and
            records them in an immutable ledger. Each member sees only their own ledger rows.
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Rewards processed</span>
              <StatusBadge
                label={order.rewards_processed ? "Yes" : "Not yet"}
                tone={order.rewards_processed ? "success" : "warning"}
              />
            </div>
            {order.rewards_processed_at ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processed at</span>
                <span>{formatDateTime(order.rewards_processed_at)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Trigger</span>
              <span>{order.qualification_source ?? "Payment confirmation"}</span>
            </div>
          </div>

          {ownRewards.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your own ledger rows for this order
              </h3>
              <ul className="mt-2 space-y-2 text-xs">
                {ownRewards.map((row) => (
                  <li key={row.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span>
                      {row.unilevel_level ? `Level ${row.unilevel_level}` : row.transaction_type}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {row.direction === "DEBIT" ? "-" : "+"}
                      {row.total_points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              You are not a beneficiary of this order, so no ledger rows are visible to you. Rewards
              for this purchase went to your uplines.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
