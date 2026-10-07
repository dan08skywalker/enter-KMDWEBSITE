import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFunction } from "@/lib/kmd/invoke";
import { methodLabel } from "@/components/site/payment-details";

interface Account {
  id: string;
  method: string;
  label: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  qr_image_url: string | null;
  is_verified: boolean;
  flag_reason: string | null;
  is_active: boolean;
  sort_order: number;
}

const METHODS = ["gcash", "maya", "maya_bank", "bank_transfer", "cash", "other"];

interface AccountForm {
  id?: string;
  method: string;
  label: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  qrImageUrl: string;
  isVerified: boolean;
  flagReason: string;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY: AccountForm = {
  method: "gcash",
  label: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  qrImageUrl: "",
  isVerified: false,
  flagReason: "",
  isActive: true,
  sortOrder: "0",
};

/**
 * Every payment account is imported, but only a verified account is published.
 * An account with a masked or conflicting name stays hidden from checkout and
 * keeps the reason it was flagged, so the decision is never lost.
 */
export default function AdminPaymentAccounts() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState<AccountForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_accounts")
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("Could not load payment accounts:", error.message);
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as Account[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (account: Account, verified: boolean) => {
    setBusy(true);
    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "review_payment_account",
      accountId: account.id,
      verified,
      reason: verified ? undefined : "Owner must confirm the registered account name",
    });
    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The account could not be updated");
      return;
    }
    toast.success(outcome.data?.reasonText ?? "Payment account updated");
    void load();
  };

  const save = async () => {
    if (!form) return;
    if (!form.accountNumber.trim()) {
      toast.error("An account number is required");
      return;
    }
    setBusy(true);

    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "save_payment_account",
      payload: {
        id: form.id ?? null,
        method: form.method,
        label: form.label.trim() || methodLabel(form.method),
        bankName: form.bankName.trim() || null,
        accountName: form.accountName.trim() || null,
        accountNumber: form.accountNumber.trim(),
        qrImageUrl: form.qrImageUrl.trim() || null,
        isVerified: form.isVerified,
        flagReason: form.flagReason.trim() || null,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      },
    });

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The account could not be saved");
      return;
    }
    toast.success(outcome.data?.reasonText ?? "Payment account saved");
    setForm(null);
    void load();
  };

  const unverified = accounts.filter((account) => account.is_active && !account.is_verified);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment accounts"
        description="The accounts customers pay into. Only a verified account appears at checkout and in the anonymous catalogue."
        actions={
          <Button type="button" variant="brand" size="sm" onClick={() => setForm({ ...EMPTY })}>
            <CreditCard className="h-3.5 w-3.5" />
            Add an account
          </Button>
        }
      />

      {unverified.length > 0 ? (
        <div className="flex gap-3 rounded-xl border border-warning/35 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold">
              {unverified.length} account{unverified.length === 1 ? "" : "s"} hidden from checkout
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/85">
              Confirm the registered account name against your records, correct it below, then press
              Verify. The account appears at checkout immediately — no redeploy needed.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment accounts yet"
          description="Add the GCash, Maya or bank accounts customers should pay into."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id} className="kmd-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {account.label ?? methodLabel(account.method)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {methodLabel(account.method)}
                    {account.bankName && account.bankName !== account.label
                      ? ` · ${account.bankName}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {account.is_active ? null : <StatusBadge label="Inactive" tone="neutral" />}
                  {account.is_verified ? (
                    <StatusBadge label="Verified" tone="success" />
                  ) : (
                    <StatusBadge label="Hidden from checkout" tone="warning" />
                  )}
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Account name</dt>
                  <dd className="mt-0.5 font-semibold">{account.account_name ?? "Not supplied"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Account number</dt>
                  <dd className="mt-0.5 font-mono font-semibold">{account.account_number ?? "—"}</dd>
                </div>
              </dl>

              {account.flag_reason ? (
                <p className="mt-3 rounded-lg border border-warning/35 bg-warning/10 p-3 text-[11px] leading-relaxed text-foreground/85">
                  {account.flag_reason}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {account.is_verified ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void review(account, false)}
                  >
                    Hide from checkout
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    disabled={busy}
                    onClick={() => void review(account, true)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Verify and publish
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({
                      id: account.id,
                      method: account.method,
                      label: account.label ?? "",
                      bankName: account.bank_name ?? "",
                      accountName: account.account_name ?? "",
                      accountNumber: account.account_number ?? "",
                      qrImageUrl: account.qr_image_url ?? "",
                      isVerified: account.is_verified,
                      flagReason: account.flag_reason ?? "",
                      isActive: account.is_active,
                      sortOrder: String(account.sort_order),
                    })
                  }
                >
                  Edit details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">
            {form.id ? "Edit payment account" : "Add a payment account"}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="account-method">Method</Label>
              <Select
                value={form.method}
                onValueChange={(value) => setForm({ ...form, method: value })}
              >
                <SelectTrigger id="account-method" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {methodLabel(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account-label">Label shown to customers</Label>
              <Input
                id="account-label"
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                className="mt-1.5"
                placeholder="GCash"
              />
            </div>
            <div>
              <Label htmlFor="account-bank">Bank name</Label>
              <Input
                id="account-bank"
                value={form.bankName}
                onChange={(event) => setForm({ ...form, bankName: event.target.value })}
                className="mt-1.5"
                placeholder="BDO Unibank, Incorporated"
              />
            </div>
            <div>
              <Label htmlFor="account-name">Registered account name</Label>
              <Input
                id="account-name"
                value={form.accountName}
                onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                className="mt-1.5"
                placeholder="Danilo Taoc"
              />
            </div>
            <div>
              <Label htmlFor="account-number">Account number</Label>
              <Input
                id="account-number"
                value={form.accountNumber}
                onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
                className="mt-1.5 font-mono"
                placeholder="09186544828"
              />
            </div>
            <div>
              <Label htmlFor="account-qr">QR image URL (optional)</Label>
              <Input
                id="account-qr"
                value={form.qrImageUrl}
                onChange={(event) => setForm({ ...form, qrImageUrl: event.target.value })}
                className="mt-1.5"
                placeholder="/brand/gcash-qr.png"
              />
            </div>
          </div>

          <div className="mt-5">
            <Label htmlFor="account-flag">Why it is not published (optional)</Label>
            <Input
              id="account-flag"
              value={form.flagReason}
              onChange={(event) => setForm({ ...form, flagReason: event.target.value })}
              className="mt-1.5"
              placeholder="Owner must confirm the registered account name"
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Active</p>
                <p className="text-[11px] text-muted-foreground">Inactive accounts are never used.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Verified</p>
                <p className="text-[11px] text-muted-foreground">
                  Only verified accounts are shown to customers.
                </p>
              </div>
              <Switch
                checked={form.isVerified}
                onCheckedChange={(checked) => setForm({ ...form, isVerified: checked })}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save account
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
