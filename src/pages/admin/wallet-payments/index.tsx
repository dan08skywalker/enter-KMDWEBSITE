import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatPeso, toNumber } from "@/lib/kmd/format";
import { walletPaymentStatus } from "@/lib/kmd/labels";
import type { WalletPayment } from "@/lib/kmd/types";

interface Row extends WalletPayment {
  memberName: string | null;
}

/**
 * Administrator view of every order paid from a member's Shopping Wallet, with
 * the money returned to the wallet and the ledger check for each member.
 */
export default function AdminWalletPayments() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Row | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from("wallet_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) {
      console.error("Could not load the wallet payments:", error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const payments = (data ?? []) as unknown as WalletPayment[];
    const memberIds = Array.from(new Set(payments.map((row) => row.member_id)));

    let names = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", memberIds);
      if (profileError) console.error("Could not load members:", profileError.message);
      names = new Map(
        ((profiles ?? []) as Array<{ id: string; first_name: string; last_name: string }>).map(
          (profile) => [profile.id, `${profile.first_name} ${profile.last_name}`],
        ),
      );
    }

    setRows(payments.map((row) => ({ ...row, memberName: names.get(row.member_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["wallet_payments"], () => void load());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;

    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (status === "refundable" && toNumber(row.amount) - toNumber(row.refunded_amount) <= 0) {
        return false;
      }
      if (status !== "all" && status !== "refundable" && row.status !== status) return false;
      if (needle) {
        const haystack =
          `${row.reference} ${row.order_number} ${row.member_code} ${row.memberName ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, from, search]);

  const totals = useMemo(
    () => ({
      paid: filtered.reduce((sum, row) => sum + toNumber(row.amount), 0),
      refunded: filtered.reduce((sum, row) => sum + toNumber(row.refunded_amount), 0),
    }),
    [filtered],
  );

  const reconcile = async (row: Row) => {
    setReconciling(row.id);
    const outcome = await invokeFunction<{
      result?: { consistent?: boolean; memberCode?: string; discrepancies?: unknown[] };
    }>("admin-actions", { action: "reconcile_balance", memberId: row.member_id });
    setReconciling(null);

    if (!outcome.ok) {
      toast.error("Could not check the member balance", { description: outcome.error });
      return;
    }

    const result = outcome.data?.result;
    if (result?.consistent) {
      toast.success(`${result.memberCode ?? row.member_code}: ledger and balance agree`);
    } else {
      toast.warning(`${result?.memberCode ?? row.member_code}: a discrepancy was found`, {
        description: `${(result?.discrepancies ?? []).length} field(s) disagree with the ledger. Open the member record for details.`,
      });
    }
  };

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "reference",
      header: "Reference",
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
    },
    {
      key: "order",
      header: "Order",
      cell: (row) => (
        <Link
          to={`/admin/orders/${row.order_id}`}
          className="font-mono text-xs font-semibold text-accent underline underline-offset-2"
        >
          {row.order_number}
        </Link>
      ),
    },
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <span className="text-xs">
          {row.memberName ?? "\u2014"}
          <br />
          <span className="font-mono text-muted-foreground">{row.member_code}</span>
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount paid",
      cell: (row) => <span className="tabular-nums">{formatPeso(row.amount)}</span>,
      className: "text-right",
    },
    {
      key: "refunded",
      header: "Refunded",
      cell: (row) => (
        <span className="tabular-nums">
          {toNumber(row.refunded_amount) > 0 ? formatPeso(row.refunded_amount) : "\u2014"}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "balance",
      header: "Balance after",
      cell: (row) => <span className="tabular-nums">{formatPeso(row.wallet_balance_after)}</span>,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = walletPaymentStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "actions",
      header: "",
      cell: (row) => {
        const refundable = toNumber(row.amount) - toNumber(row.refunded_amount);
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => void reconcile(row)}
              disabled={reconciling === row.id}
            >
              {reconciling === row.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="h-3 w-3" />
              )}
              Reconcile
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setRefundTarget(row)}
              disabled={refundable <= 0}
            >
              <RotateCcw className="h-3 w-3" />
              Refund
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Wallet Payments"
        description="Every order settled from a member's Shopping Wallet, with the money returned to the wallet and a ledger reconciliation per member."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          A wallet payment is taken, and its order marked paid, in one transaction: the member is
          verified from their session, the total comes from the order itself, and the wallet can never
          go negative. One order can only ever be charged once. A refund returns the money to the same
          member's Shopping Wallet and cannot be paid twice.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="wallet-payments-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="wallet-payments-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search reference, order, member name or member ID"
        />
        <div className="space-y-1">
          <Label htmlFor="wallet-payments-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            From
          </Label>
          <Input
            id="wallet-payments-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-[160px]"
          />
        </div>
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "completed", label: "Paid" },
            { value: "partially_refunded", label: "Partly refunded" },
            { value: "refunded", label: "Refunded" },
            { value: "refundable", label: "Still refundable" },
          ]}
          className="sm:w-[190px]"
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{filtered.length}</span> payments
        </span>
        <span>
          Received <span className="font-semibold text-foreground">{formatPeso(totals.paid)}</span>
        </span>
        <span>
          Refunded <span className="font-semibold text-foreground">{formatPeso(totals.refunded)}</span>
        </span>
        <span>
          Net{" "}
          <span className="font-semibold text-foreground">
            {formatPeso(totals.paid - totals.refunded)}
          </span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={RotateCcw}
            title="No Shopping Wallet payments yet"
            description="Orders paid from a member's Shopping Wallet appear here with their reference and remaining balance."
          />
        }
      />

      <RefundDialog
        row={refundTarget}
        onClose={() => setRefundTarget(null)}
        onDone={() => {
          setRefundTarget(null);
          void load();
        }}
      />
    </>
  );
}

/** Refund dialog: the remaining amount by default, and a reason that is recorded. */
function RefundDialog({
  row,
  onClose,
  onDone,
}: {
  row: Row | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const refundable = row ? toNumber(row.amount) - toNumber(row.refunded_amount) : 0;
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(row ? String(refundable) : "");
    setReason("");
    setError(null);
  }, [row, refundable]);

  if (!row) return null;

  const requested = toNumber(amount, NaN);
  const problem = !Number.isFinite(requested)
    ? "Enter the amount to return to the member's wallet."
    : requested <= 0
      ? "The amount must be greater than zero."
      : requested > refundable
        ? `That is more than the ${formatPeso(refundable)} still refundable.`
        : reason.trim().length === 0
          ? "A reason is required so the refund is traceable."
          : null;

  const confirm = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);

    const outcome = await invokeFunction<{
      result?: { status?: string; reference?: string; amount?: number; walletBalance?: number; reasonText?: string };
    }>("admin-actions", {
      action: "refund_wallet_payment",
      paymentId: row.id,
      amount: requested,
      reason: reason.trim(),
      idempotencyKey: crypto.randomUUID(),
    });
    setBusy(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The refund could not be completed.");
      return;
    }

    const result = outcome.data?.result;
    if (result?.status !== "REFUNDED") {
      setError(result?.reasonText ?? "The refund was refused.");
      return;
    }

    toast.success("Refunded to the Shopping Wallet", {
      description: `${formatPeso(result.amount ?? requested)} returned for ${row.order_number} (reference ${result.reference}). Remaining wallet balance ${formatPeso(result.walletBalance ?? 0)}.`,
    });
    onDone();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Refund to Shopping Wallet</DialogTitle>
          <DialogDescription>
            The amount is credited back to the same member's Shopping Wallet and recorded against
            payment {row.reference} for order {row.order_number}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <dl className="space-y-2 rounded-lg border p-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Member</dt>
              <dd className="font-semibold">
                {row.memberName ?? "\u2014"}{" "}
                <span className="font-mono text-muted-foreground">{row.member_code}</span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="tabular-nums">{formatPeso(row.amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Already refunded</dt>
              <dd className="tabular-nums">{formatPeso(row.refunded_amount)}</dd>
            </div>
            <div className="flex justify-between border-t pt-2">
              <dt className="text-muted-foreground">Still refundable</dt>
              <dd className="font-bold tabular-nums">{formatPeso(refundable)}</dd>
            </div>
          </dl>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="refund-amount">Amount to return</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setAmount(String(refundable))}
              >
                Full amount
              </Button>
            </div>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Recorded on the audit log and in the member's wallet history"
            />
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Return {formatPeso(Number.isFinite(requested) ? requested : 0)} to wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
