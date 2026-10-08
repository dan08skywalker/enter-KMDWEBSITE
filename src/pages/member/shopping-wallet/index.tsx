import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Coins,
  History,
  Loader2,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { useConversionRate } from "@/hooks/use-conversion-rate";
import { usePointRate } from "@/hooks/use-point-rate";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import {
  CONVERSION_DIRECTIONS,
  computeConversion,
  describeRate,
} from "@/lib/kmd/conversion";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Points } from "@/components/kmd/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus } from "@/lib/kmd/labels";
import type {
  ConversionDirection,
  WalletConversion,
  WalletLedgerRow,
} from "@/lib/kmd/types";

interface ConversionOutcome {
  status?: string;
  reason?: string;
  reasonText?: string;
  reference?: string;
  direction?: ConversionDirection;
  amountDeducted?: number;
  amountCredited?: number;
  pointsBalance?: number;
  walletBalance?: number;
}

export default function MemberShoppingWallet() {
  const { user } = useAuth();
  const pointRate = usePointRate();
  const conversion = useConversionRate();
  const ledger = useMemberLedger();

  const [conversions, setConversions] = useState<WalletConversion[]>([]);
  const [loadingConversions, setLoadingConversions] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [direction, setDirection] = useState<ConversionDirection>("POINTS_TO_WALLET");
  const [amount, setAmount] = useState("");
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversions = useCallback(async () => {
    if (!user) return;
    const { data, error: loadError } = await supabase
      .from("wallet_conversions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (loadError) {
      console.error("Could not load the conversions:", loadError.message);
      setConversions([]);
    } else {
      setConversions((data ?? []) as unknown as WalletConversion[]);
    }
    setLoadingConversions(false);
  }, [user]);

  useEffect(() => {
    void loadConversions();
  }, [loadConversions]);

  useRealtimeRefresh(["wallet_conversions"], () => void loadConversions());

  const rateValue = conversion.rate ?? 0;
  const rateConfigured = conversion.rate !== null && conversion.rate > 0;
  const meta = CONVERSION_DIRECTIONS[direction];

  const sourceBalance = direction === "POINTS_TO_WALLET" ? ledger.availablePoints : ledger.shoppingWallet;
  const requested = toNumber(amount);
  const { fee, net, credited } = computeConversion(requested, direction, rateValue, conversion.feePercent);

  const problems = useMemo(() => {
    const found: string[] = [];
    if (!rateConfigured) return found;
    if (!amount.trim()) found.push("Enter an amount.");
    else if (requested <= 0) found.push("The amount must be greater than zero.");
    else if (requested > sourceBalance) {
      found.push(`That is more than your ${meta.fromLabel} balance of ${formatPoints(sourceBalance)}.`);
    }
    if (requested > 0 && requested <= sourceBalance && credited <= 0) {
      found.push("That amount is too small to convert at the current rate.");
    }
    return found;
  }, [amount, requested, sourceBalance, credited, rateConfigured, meta.fromLabel]);

  const resetForm = () => {
    setStep("form");
    setAmount("");
    setSubmissionKey(null);
    setError(null);
  };

  const openDialog = () => {
    resetForm();
    setDirection("POINTS_TO_WALLET");
    setDialogOpen(true);
  };

  const review = () => {
    if (!rateConfigured) return;
    if (problems.length > 0) {
      setError(problems[0]);
      return;
    }
    setError(null);
    // One key per submission, so a double click or a retried request is
    // recognised by the server instead of moving the balance twice.
    setSubmissionKey(crypto.randomUUID());
    setStep("review");
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);

    const outcome = await invokeFunction<{ conversion?: ConversionOutcome }>("member-actions", {
      action: "convert_balance",
      direction,
      amount: requested,
      idempotencyKey: submissionKey,
    });
    setBusy(false);

    const result = outcome.data?.conversion;

    if (!outcome.ok) {
      // Both balances are untouched when the backend refuses.
      setError(outcome.error ?? "The conversion could not be completed.");
      setStep("form");
      return;
    }

    if (result?.status === "DUPLICATE") {
      toast.info("This conversion was already processed", {
        description: result.reasonText ?? "Nothing was moved a second time.",
      });
      resetForm();
      setDialogOpen(false);
      await Promise.all([ledger.reload(), loadConversions()]);
      return;
    }

    if (result?.status !== "CONVERTED") {
      setError(result?.reasonText ?? "The conversion was refused.");
      setStep("form");
      return;
    }

    toast.success("Conversion complete", {
      description: `Reference ${result.reference}: ${formatPoints(result.amountDeducted)} ${meta.fromLabel} → ${formatPoints(result.amountCredited)} ${meta.toLabel}.`,
    });

    resetForm();
    setDialogOpen(false);
    await Promise.all([ledger.reload(), loadConversions()]);
  };

  const conversionColumns: Column<WalletConversion>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "reference",
      header: "Reference",
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
    },
    {
      key: "direction",
      header: "Direction",
      cell: (row) => (
        <StatusBadge
          label={CONVERSION_DIRECTIONS[row.direction]?.label ?? row.direction}
          tone={row.direction === "POINTS_TO_WALLET" ? "gold" : "platinum"}
        />
      ),
    },
    {
      key: "deducted",
      header: "Deducted",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.amount_deducted)}</span>,
      className: "text-right",
    },
    {
      key: "credited",
      header: "Credited",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.amount_credited)}</span>,
      className: "text-right",
    },
    {
      key: "rate",
      header: "Rate",
      cell: (row) => <span className="tabular-nums">{row.rate}</span>,
      className: "text-right",
    },
    {
      key: "fee",
      header: "Fee",
      cell: (row) => (
        <span className="tabular-nums">
          {formatPoints(row.fee_amount)}
          {row.fee_percent > 0 ? ` (${row.fee_percent}%)` : ""}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          label={row.status === "posted" ? "Posted" : "Reversed"}
          tone={row.status === "posted" ? "success" : "danger"}
        />
      ),
    },
  ];

  const walletColumns: Column<WalletLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "txn",
      header: "Transaction ID",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    {
      key: "direction",
      header: "Direction",
      cell: (row) => (
        <StatusBadge
          label={row.direction === "CREDIT" ? "Credit" : "Debit"}
          tone={row.direction === "CREDIT" ? "success" : "warning"}
        />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <Points value={row.amount} direction={row.direction} showSign />,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = ledgerStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "note", header: "Note", cell: (row) => row.note ?? "\u2014" },
  ];

  return (
    <>
      <PageHeader
        title="Shopping Wallet"
        description="Move balance between your Shopping Wallet and your Available Unilevel Points."
        actions={
          <Button onClick={openDialog} disabled={conversion.loading || !rateConfigured}>
            <ArrowRightLeft className="h-4 w-4" />
            Convert Balance
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Shopping Wallet Balance"
          value={formatPoints(ledger.shoppingWallet)}
          hint={formatPeso(ledger.shoppingWallet, pointRate)}
          icon={ShoppingBag}
          accent="platinum"
          loading={ledger.loading}
        />
        <StatCard
          label="Available Unilevel Points"
          value={formatPoints(ledger.availablePoints)}
          hint={ledger.heldPoints > 0 ? `${formatPoints(ledger.heldPoints)} held for redemptions` : "Ready to convert"}
          icon={Coins}
          accent="gold"
          loading={ledger.loading}
        />
        <StatCard
          label="Conversion Rate"
          value={rateConfigured ? String(conversion.rate) : "Not set"}
          hint={
            rateConfigured
              ? conversion.feePercent > 0
                ? `Fee ${conversion.feePercent}%`
                : "No conversion fee"
              : "Conversions are disabled"
          }
          icon={ArrowRightLeft}
          accent="primary"
          loading={conversion.loading}
        />
      </div>

      {!conversion.loading && !rateConfigured ? (
        <div className="kmd-panel border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
            <div>
              <p className="text-sm font-semibold">Conversions are not available yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                An administrator has not set the conversion rate, so nothing can be converted between your
                Shopping Wallet and your Unilevel Points. Your balances are unaffected and you will be able
                to convert as soon as the rate is configured.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Conversion history</h2>
        </div>
        <DataTable
          columns={conversionColumns}
          rows={conversions}
          rowKey={(row) => row.id}
          loading={loadingConversions}
          empty={
            <EmptyState
              icon={ArrowRightLeft}
              title="No conversions yet"
              description="Conversions you make between your Shopping Wallet and Unilevel Points appear here with their reference, rate and fee."
            />
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Wallet ledger</h2>
        <DataTable
          columns={walletColumns}
          rows={ledger.walletRows}
          rowKey={(row) => row.id}
          loading={ledger.loading}
          empty={
            <EmptyState
              icon={ShoppingBag}
              title="Your wallet is empty"
              description="Balance you convert into the Shopping Wallet appears here immediately."
            />
          }
        />
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (busy ? null : (open ? setDialogOpen(true) : (setDialogOpen(false), resetForm())))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convert Balance</DialogTitle>
            <DialogDescription>
              {rateConfigured ? describeRate(rateValue) : "Conversions are disabled"} ·{" "}
              {conversion.feePercent > 0 ? `Fee ${conversion.feePercent}%` : "No fee"}
            </DialogDescription>
          </DialogHeader>

          {step === "form" ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Direction</Label>
                <div className="grid gap-2">
                  {(Object.keys(CONVERSION_DIRECTIONS) as ConversionDirection[]).map((key) => {
                    const option = CONVERSION_DIRECTIONS[key];
                    const active = direction === key;
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => {
                          setDirection(key);
                          setAmount("");
                          setError(null);
                        }}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        <span className="text-left">
                          {option.fromLabel}
                          <ArrowRight className="mx-1 inline h-3 w-3" />
                          {option.toLabel}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{meta.fromLabel}</dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(sourceBalance)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{meta.toLabel}</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatPoints(direction === "POINTS_TO_WALLET" ? ledger.shoppingWallet : ledger.availablePoints)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <div className="flex items-end justify-between gap-2">
                  <Label htmlFor="convert-amount">Amount to convert</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setAmount(String(sourceBalance))}
                    disabled={sourceBalance <= 0}
                  >
                    Max
                  </Button>
                </div>
                <Input
                  id="convert-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                />
              </div>

              <dl className="space-y-2 rounded-lg border p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">You will convert</dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(net)}</dd>
                </div>
                {fee > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Fee ({conversion.feePercent}%)</dt>
                    <dd className="font-semibold tabular-nums">{formatPoints(fee)}</dd>
                  </div>
                ) : null}
                <Separator />
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">You will receive</dt>
                  <dd className="text-sm font-bold tabular-nums text-[hsl(var(--gold))]">
                    {formatPoints(credited)}
                  </dd>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Rate {describeRate(rateValue)}. {meta.toLabel} is credited in a single transaction with the
                  deduction from {meta.fromLabel}.
                </p>
              </dl>

              {error ?? (problems.length > 0 && amount.trim() ? problems[0] : null) ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error ?? problems[0]}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm the conversion. Both balances move together, or not at all.
              </p>

              <dl className="space-y-2 rounded-lg border p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Direction</dt>
                  <dd className="font-semibold">{meta.label}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Deducted from {meta.fromLabel}</dt>
                  <dd className="font-semibold tabular-nums text-destructive">
                    -{formatPoints(requested)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Credited to {meta.toLabel}</dt>
                  <dd className="font-semibold tabular-nums text-[hsl(var(--success))]">
                    +{formatPoints(credited)}
                  </dd>
                </div>
                <Separator />
                <div className="flex justify-between text-xs">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="tabular-nums">{describeRate(rateValue)}</dd>
                </div>
                <div className="flex justify-between text-xs">
                  <dt className="text-muted-foreground">Fee</dt>
                  <dd className="tabular-nums">
                    {conversion.feePercent > 0
                      ? `${formatPoints(fee)} (${conversion.feePercent}%)`
                      : "None"}
                  </dd>
                </div>
              </dl>

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {step === "form" ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={review} disabled={!rateConfigured || problems.length > 0}>
                  Review conversion
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep("form")} disabled={busy}>
                  Back
                </Button>
                <Button onClick={() => void confirm()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirm conversion
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
