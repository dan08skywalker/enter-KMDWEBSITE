import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HandCoins,
  History,
  Loader2,
  Minus,
  Plus,
  Search,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { MemberCell } from "@/components/kmd/member-cell";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus } from "@/lib/kmd/labels";
import type { LoyaltyLedgerRow, Profile } from "@/lib/kmd/types";

interface AdjustmentResult {
  status?: string;
  reason?: string;
  reasonText?: string;
  transactionId?: string;
  memberCode?: string;
  memberName?: string;
  direction?: string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
}

/** The balance rule, matching the server: posted credits minus posted debits. */
function deriveBalance(rows: LoyaltyLedgerRow[]): number {
  return rows.reduce((total, row) => {
    if (row.status !== "posted") return total;
    const amount = toNumber(row.credit_amount);
    return row.direction === "CREDIT" ? total + amount : total - amount;
  }, 0);
}

export function LoyaltyAdjustmentPanel() {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);

  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledger, setLedger] = useState<LoyaltyLedgerRow[]>([]);

  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = useMemo(() => deriveBalance(ledger), [ledger]);

  const loadLedger = useCallback(async (memberId: string) => {
    setLoadingLedger(true);
    const { data, error: ledgerError } = await supabase
      .from("loyalty_credit_ledger")
      .select("*")
      .eq("beneficiary_id", memberId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ledgerError) {
      console.error("Could not load the loyalty ledger:", ledgerError.message);
      setLedger([]);
    } else {
      setLedger((data ?? []) as unknown as LoyaltyLedgerRow[]);
    }
    setLoadingLedger(false);
  }, []);

  useEffect(() => {
    if (selected) void loadLedger(selected.id);
    else setLedger([]);
  }, [selected, loadLedger]);

  useRealtimeRefresh(
    ["loyalty_credit_ledger"],
    () => {
      if (selected) void loadLedger(selected.id);
    },
    selected ? `beneficiary_id=eq.${selected.id}` : undefined,
  );

  const runSearch = async () => {
    const term = search.trim();
    if (term.length < 2) {
      toast.error("Type at least two characters of a name, member ID or username");
      return;
    }

    setSearching(true);
    const { data, error: searchError } = await supabase
      .from("profiles")
      .select("*")
      .or(
        `member_code.ilike.%${term}%,username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`,
      )
      .limit(8);
    setSearching(false);

    if (searchError) {
      console.error("Member search failed:", searchError.message);
      toast.error("The member search failed", { description: searchError.message });
      return;
    }

    setResults((data ?? []) as unknown as Profile[]);
    if ((data ?? []).length === 0) {
      toast.info("No member matched that search");
    }
  };

  const requestedAmount = toNumber(amount);
  const resultingBalance = direction === "CREDIT" ? balance + requestedAmount : balance - requestedAmount;

  const validation = useMemo(() => {
    const problems: string[] = [];
    if (!amount.trim()) problems.push("Enter an amount.");
    else if (requestedAmount <= 0) problems.push("The amount must be greater than zero.");
    if (direction === "DEBIT" && requestedAmount > balance) {
      problems.push(
        `That deduction is larger than the available balance. The most you can deduct is ${formatPoints(balance)}.`,
      );
    }
    if (!reason.trim()) problems.push("A reason is required.");
    return { ok: problems.length === 0, problems };
  }, [amount, requestedAmount, direction, balance, reason]);

  const review = () => {
    if (!validation.ok) {
      setError(validation.problems[0] ?? "Please correct the form.");
      return;
    }
    setError(null);
    // One key per submission: a double click or a retried request is recognised
    // by the server instead of being applied twice.
    setSubmissionKey(crypto.randomUUID());
    setStep("review");
  };

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const outcome = await invokeFunction<AdjustmentResult>("admin-actions", {
      action: "adjust_loyalty_credits",
      memberId: selected.id,
      amount: requestedAmount,
      direction,
      reason: reason.trim(),
      idempotencyKey: submissionKey,
    });
    setSaving(false);

    const result = outcome.data as AdjustmentResult | undefined;

    if (!outcome.ok) {
      setError(outcome.error ?? "The adjustment could not be saved");
      setStep("form");
      return;
    }

    if (result?.status === "DUPLICATE") {
      toast.info("This adjustment was already applied", {
        description: result.reasonText ?? "Nothing was changed a second time.",
      });
      setStep("form");
      setAmount("");
      setReason("");
      setSubmissionKey(null);
      await loadLedger(selected.id);
      return;
    }

    if (result?.status !== "ADJUSTED") {
      setError(result?.reasonText ?? "The adjustment was refused.");
      setStep("form");
      return;
    }

    toast.success(result.reasonText ?? "Loyalty credits adjusted", {
      description: `${result.transactionId} · balance ${formatPoints(result.balanceBefore)} → ${formatPoints(result.balanceAfter)}`,
    });

    setStep("form");
    setAmount("");
    setReason("");
    setSubmissionKey(null);
    await loadLedger(selected.id);
  };

  const columns: Column<LoyaltyLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "txn",
      header: "Transaction ID",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => (
        <span
          className={`font-semibold tabular-nums ${
            row.direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"
          }`}
        >
          {row.direction === "CREDIT" ? "+" : "-"}
          {formatPoints(row.credit_amount)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "balance",
      header: "Balance",
      cell: (row) =>
        row.balance_after === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{formatPoints(row.balance_after)}</span>
        ),
      className: "text-right",
    },
    {
      key: "trigger",
      header: "Source",
      cell: (row) => (
        <StatusBadge
          label={row.trigger_event === "admin_adjustment" ? "Admin adjustment" : "Purchase reward"}
          tone={row.trigger_event === "admin_adjustment" ? "warning" : "gold"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = ledgerStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "note", header: "Reason", cell: (row) => <span className="text-xs">{row.note ?? "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5">
          <div className="kmd-panel p-5">
            <div className="flex items-center gap-2">
              <UserRoundSearch className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Select a member</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Search by name, KMD member ID or username.
            </p>

            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runSearch();
                  }}
                  placeholder="Name, KMD-0000-0000-0000-0000 or username"
                  className="pl-9"
                />
              </div>
              <Button onClick={() => void runSearch()} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </div>

            {results.length > 0 ? (
              <ul className="mt-3 divide-y rounded-lg border">
                {results.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(candidate);
                        setResults([]);
                        setSearch(candidate.member_code);
                        setStep("form");
                        setError(null);
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
                        selected?.id === candidate.id ? "bg-muted" : ""
                      }`}
                    >
                      <MemberCell profile={candidate} />
                      {candidate.is_test ? <StatusBadge label="Test" tone="platinum" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {selected ? (
            <div className="kmd-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <MemberCell profile={selected} showStatus />
                <div className="text-right">
                  <p className="kmd-label">Loyalty credits</p>
                  {loadingLedger ? (
                    <Skeleton className="mt-1 h-7 w-24" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold tabular-nums">{formatPoints(balance)}</p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="kmd-label">Recent loyalty transactions</p>
              </div>

              {loadingLedger ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-8 w-full" />
                  ))}
                </div>
              ) : ledger.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No loyalty transactions for this member yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y">
                  {ledger.slice(0, 5).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
                      <span className="truncate">{row.note ?? row.trigger_event ?? "—"}</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          row.direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"
                        }`}
                      >
                        {row.direction === "CREDIT" ? "+" : "-"}
                        {formatPoints(row.credit_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <div className="kmd-panel p-5">
          {!selected ? (
            <EmptyState
              icon={HandCoins}
              title="Choose a member to begin"
              description="Search above, then add or deduct loyalty credits with a recorded reason."
            />
          ) : step === "form" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Adjustment</h2>
              </div>

              <div className="space-y-2">
                <Label>Direction</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={direction === "CREDIT" ? "default" : "outline"}
                    onClick={() => setDirection("CREDIT")}
                  >
                    <Plus className="h-4 w-4" />
                    Add credits
                  </Button>
                  <Button
                    type="button"
                    variant={direction === "DEBIT" ? "destructive" : "outline"}
                    onClick={() => setDirection("DEBIT")}
                  >
                    <Minus className="h-4 w-4" />
                    Deduct credits
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loyalty-amount">Amount</Label>
                <Input
                  id="loyalty-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">
                  Current balance {formatPoints(balance)}. A deduction can never take the balance below
                  zero.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="loyalty-reason">Reason</Label>
                <Textarea
                  id="loyalty-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  placeholder="Why this adjustment is being made (stored on the ledger entry)"
                />
              </div>

              <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Current balance</dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(balance)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {direction === "CREDIT" ? "Adding" : "Deducting"}
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(requestedAmount)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground">Resulting balance</dt>
                  <dd
                    className={`font-bold tabular-nums ${
                      resultingBalance < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatPoints(resultingBalance)}
                  </dd>
                </div>
              </dl>

              {!validation.ok && (amount.trim().length > 0 || reason.trim().length > 0) ? (
                <ul className="space-y-1 text-[11px] text-destructive">
                  {validation.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}

              <Button className="w-full" onClick={review} disabled={!validation.ok || loadingLedger}>
                Review adjustment
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                <h2 className="text-sm font-semibold">Confirm this adjustment</h2>
              </div>

              <div className="rounded-lg border p-4">
                <MemberCell profile={selected} />
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Action</span>
                    <StatusBadge
                      label={direction === "CREDIT" ? "Add loyalty credits" : "Deduct loyalty credits"}
                      tone={direction === "CREDIT" ? "success" : "danger"}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold tabular-nums">{formatPoints(requestedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">
                      {formatPoints(balance)}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className={direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"}>
                        {formatPoints(resultingBalance)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-muted-foreground">Reason</span>
                    <span className="max-w-[70%] text-right text-xs">{reason.trim()}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                This writes one new loyalty-credit ledger entry, recording the previous and new balances,
                the reason, your account and the time. No commission, wallet balance, order, payment or
                member detail is affected.
              </p>

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("form")}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button className="flex-1" onClick={() => void confirm()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Confirm adjustment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selected ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Loyalty transaction history</h2>
          <DataTable
            columns={columns}
            rows={ledger}
            rowKey={(row) => row.id}
            loading={loadingLedger}
            empty={
              <EmptyState
                icon={History}
                title="No loyalty transactions"
                description="Adjustments and purchase rewards both appear here once they exist."
              />
            }
          />
        </section>
      ) : null}
    </div>
  );
}
