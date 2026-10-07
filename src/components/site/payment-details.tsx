import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaymentAccount } from "@/lib/site/types";

const METHOD_LABEL: Record<string, string> = {
  gcash: "GCash",
  maya: "Maya",
  maya_bank: "Maya Bank",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  other: "Other",
};

export function methodLabel(method: string): string {
  return METHOD_LABEL[method] ?? method;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused; the number stays visible either way.
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 shrink-0 px-2 text-[11px]"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * The payment options a customer may choose.
 *
 * Only accounts the owner has verified reach this component — the backend never
 * returns an unverified account to an anonymous caller, so there is nothing here
 * to filter.
 */
export function PaymentDetails({
  accounts,
  selectedMethod,
  onSelect,
  readOnly = false,
}: {
  accounts: PaymentAccount[];
  selectedMethod?: string | null;
  onSelect?: (method: string) => void;
  readOnly?: boolean;
}) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-warning/35 bg-warning/10 p-4">
        <p className="text-xs font-semibold">No payment account is published yet</p>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
          The owner has not verified a payment account, so checkout cannot take a payment yet. Please
          contact us and we will help you complete the order.
        </p>
      </div>
    );
  }

  // One group per method so GCash, Maya and the banks stay visually separate.
  const groups = new Map<string, PaymentAccount[]>();
  for (const account of accounts) {
    const bucket = groups.get(account.method) ?? [];
    bucket.push(account);
    groups.set(account.method, bucket);
  }

  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([method, rows]) => (
        <div key={method}>
          <p className="kmd-eyebrow text-muted-foreground">{methodLabel(method)}</p>
          <ul className="mt-2 space-y-2">
            {rows.map((account) => {
              const selected = selectedMethod === account.method;
              return (
                <li key={account.id}>
                  <div
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      !readOnly && !selected && "hover:border-primary/40",
                      selected && "border-gold bg-gold/8",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!readOnly && onSelect ? (
                        <input
                          type="radio"
                          name="payment-method"
                          className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
                          checked={selected}
                          onChange={() => onSelect(account.method)}
                          aria-label={`Pay using ${account.label ?? methodLabel(method)}`}
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">
                          {account.label ?? methodLabel(method)}
                          {account.bankName && account.bankName !== account.label ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              {account.bankName}
                            </span>
                          ) : null}
                        </p>
                        <dl className="mt-2 space-y-1">
                          {account.accountName ? (
                            <div className="flex items-center gap-2 text-[11px]">
                              <dt className="text-muted-foreground">Account name</dt>
                              <dd className="font-medium">{account.accountName}</dd>
                            </div>
                          ) : null}
                          {account.accountNumber ? (
                            <div className="flex items-center gap-2 text-[11px]">
                              <dt className="text-muted-foreground">Account number</dt>
                              <dd className="flex items-center gap-2">
                                <span className="font-mono font-medium tracking-wide">
                                  {account.accountNumber}
                                </span>
                                <CopyButton
                                  value={account.accountNumber}
                                  label={`${account.label ?? methodLabel(method)} account number`}
                                />
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>

                      {account.qrImageUrl ? (
                        <img
                          src={account.qrImageUrl}
                          alt={`${account.label ?? methodLabel(method)} QR code`}
                          crossOrigin="anonymous"
                          className="h-20 w-20 shrink-0 rounded-md border object-contain"
                        />
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Pay the exact amount due, then attach a photo or PDF of your receipt. We never ask for your
        card number, bank password or a one-time code.
      </p>
    </div>
  );
}
