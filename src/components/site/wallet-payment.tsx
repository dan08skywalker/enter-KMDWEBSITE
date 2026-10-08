import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatPeso } from "@/lib/kmd/format";

/** Where a member tops up the Shopping Wallet from Available Unilevel Points. */
export const WALLET_TOPUP_PATH = "/app/shopping-wallet";

/**
 * The Shopping Wallet payment option.
 *
 * It is deliberately honest about what the member can and cannot do: the balance
 * and the amount payable are both shown, and when the balance is short the
 * difference is stated with a link to the conversion feature instead of a button
 * that would fail.
 */
export function WalletPaymentOption({
  signedIn,
  balance,
  balanceLoading,
  total,
  totalFinal,
  selected,
  onSelect,
}: {
  signedIn: boolean;
  balance: number;
  balanceLoading: boolean;
  total: number;
  /** false while a delivery fee is still to be confirmed by the owner. */
  totalFinal: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const shortfall = Math.max(round2(total - balance), 0);
  const covered = totalFinal && total > 0 && balance >= total;
  const disabled = !signedIn || !totalFinal || !covered;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        !disabled && !selected && "hover:border-primary/40",
        selected && !disabled && "border-gold bg-gold/8",
        disabled && "border-dashed",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="payment-method"
          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
          checked={selected && !disabled}
          disabled={disabled}
          onChange={onSelect}
          aria-label="Pay using my Shopping Wallet"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold">
            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
            Shopping Wallet
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Paid instantly from your wallet balance. No receipt to upload and no waiting for
            verification.
          </p>

          {!signedIn ? (
            <p className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-relaxed">
              <Link to="/login" className="font-semibold text-accent underline underline-offset-2">
                Sign in
              </Link>{" "}
              to pay with your Shopping Wallet. Everything in your bag stays where it is.
            </p>
          ) : (
            <>
              <dl className="mt-3 space-y-1 text-[11px]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Shopping Wallet balance</dt>
                  <dd className="font-semibold tabular-nums">
                    {balanceLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      formatPeso(balance)
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Total amount payable</dt>
                  <dd className="font-semibold tabular-nums">
                    {totalFinal ? formatPeso(total) : "To be confirmed"}
                  </dd>
                </div>
                {covered ? (
                  <div className="flex items-center justify-between gap-3 border-t pt-1">
                    <dt className="text-muted-foreground">Balance left after payment</dt>
                    <dd className="font-bold tabular-nums text-[hsl(var(--success))]">
                      {formatPeso(round2(balance - total))}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {!totalFinal ? (
                <div className="mt-3 flex gap-2 rounded-md border border-warning/35 bg-warning/10 p-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <p className="text-[11px] leading-relaxed text-foreground/85">
                    Your delivery fee has not been finalised yet, so the Shopping Wallet cannot cover
                    the full total. Check back once the fee is confirmed, or pay by transfer.
                  </p>
                </div>
              ) : null}

              {totalFinal && total > 0 && !covered ? (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Short by {formatPeso(shortfall)}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Convert Available Unilevel Points into your Shopping Wallet to cover the
                    difference. Your bag is kept as it is.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-2 h-7 text-[11px]">
                    <Link to={WALLET_TOPUP_PATH} target="_blank" rel="noreferrer">
                      <ArrowRightLeft className="h-3 w-3" />
                      Convert Points to Shopping Wallet
                    </Link>
                  </Button>
                </div>
              ) : null}

              {covered ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[hsl(var(--success))]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Your balance covers this order in full.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The confirmation shown before a wallet payment: the order total and what the
 * balance will be afterwards, so the member sees the cost of the order twice
 * before it is taken.
 */
export function WalletPaymentSummary({
  total,
  balance,
  reference,
}: {
  total: number;
  balance: number;
  reference?: string | null;
}) {
  return (
    <dl className="space-y-2 rounded-lg border p-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Order total</dt>
        <dd className="font-semibold tabular-nums">{formatPeso(total)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Shopping Wallet balance</dt>
        <dd className="font-semibold tabular-nums">{formatPeso(balance)}</dd>
      </div>
      <Separator />
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Remaining after payment</dt>
        <dd className="font-bold tabular-nums text-[hsl(var(--success))]">
          {formatPeso(round2(balance - total))}
        </dd>
      </div>
      {reference ? (
        <div className="flex justify-between text-xs">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-mono">{reference}</dd>
        </div>
      ) : null}
    </dl>
  );
}
