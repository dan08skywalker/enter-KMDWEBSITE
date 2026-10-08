import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
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
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus, transactionType } from "@/lib/kmd/labels";
import type { PointLedgerRow, Profile } from "@/lib/kmd/types";

interface AdjustmentResult {
  status?: string;
  reason?: string;
  reasonText?: string;
  transactionId?: string;
  memberCode?: string;
  memberName?: string;
  direction?: string;
  points?: number;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  availableAfter?: number;
  heldPoints?: number;
  available?: number;
}

/** The balances the server derives from the ledger for one member. */
interface MemberBalances {
  availablePoints: number;
  unilevelPoints: number;
  pendingPoints: number;
}

/**
 * Adjust Unilevel Points by hand: Credit adds, Debit deducts.
 *
 * The balance shown is always the ledger-derived figure from the server, and the
 * server re-checks it inside the transaction, so the preview can never be used to
 * overdraw an account.
 */
export function PointAdjustmentPanel() {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);

  const [balances, setBalances] = useState<MemberBalances | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [ledger, setLedger] = useState<PointLedgerRow[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");
  const [submissionKey, setSubmissionKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async (memberId: string) => {
    setLoadingBalances(true);
    const { data, error: balanceError } = await supabase.rpc("kmd_member_points_summary", {
      p_member: memberId,
    });

    if (balanceError) {
      console.error("Could not read the member balances:", balanceError.message);
      setBalances(null);
    } else {
      const row = (data ?? {}) as Record<string, unknown>;
      setBalances({
        availablePoints: toNumber(row.availablePoints),
        unilevelPoints: toNumber(row.unilevelPoints),
        pendingPoints: toNumber(row.pendingPoints),
      });
    }
    setLoadingBalances(false);
  }, []);

  const loadLedger = useCallback(async (memberId: string) => {
    setLoadingLedger(true);
    const { data, error: ledgerError } = await supabase
      .from("point_ledger")
      .select("*")
      .eq("beneficiary_id", memberId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ledgerError) {
      console.error("Could not load the point ledger:", ledgerError.message);
      setLedger([]);
      setLoadingLedger(false);
      return;
    }

    const rows = (data ?? []) as unknown as PointLedgerRow[];
    setLedger(rows);

    // Name the administrator on manual entries, so the history shows who acted.
    const actorIds = Array.from(
      new Set(rows.map((row) => row.processed_by).filter((id): id is string => Boolean(id))),
    );
    if (actorIds.length > 0) {
      const { data: actors, error: actorError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, member_code")
        .in("id", actorIds);
      if (actorError) console.error("Could not load the administrators:", actorError.message);
      setActorNames(
        Object.fromEntries(
          ((actors ?? []) as Array<{
            id: string;
            first_name: string;
            last_name: string;
            member_code: string;
          }>).map((actor) => [actor.id, `${actor.first_name} ${actor.last_name}`.trim()]),
        ),
      );
    } else {
      setActorNames({});
    }

    setLoadingLedger(false);
  }, []);

  // Balances and history refresh the moment the adjustment lands, so the page
  // never shows a stale figure after a successful change.
  const refresh = useCallback(async () => {
    if (!selected) return;
    await Promise.all([loadBalances(selected.id), loadLedger(selected.id)]);
  }, [selected, loadBalances, loadLedger]);

  useEffect(() => {
    if (selected) void refresh();
    else {
      setBalances(null);
      setLedger([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useRealtimeRefresh(
    ["point_ledger"],
    () => {
      if (selected) void refresh();
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
    if ((data ?? []).length === 0) toast.info("No member matched that search");
  };

  const available = balances?.availablePoints ?? 0;
  const held = balances?.pendingPoints ?? 0;
  const requestedAmount = toNumber(amount);
  const resultingAvailable =
    direction === "CREDIT" ? available + requestedAmount : available - requestedAmount;
  const resultingTotal =
    (balances?.unilevelPoints ?? 0) +
    (direction === "CREDIT" ? requestedAmount : -requestedAmount);

  const validation = useMemo(() => {
    const problems: string[] = [];
    if (!amount.trim()) problems.push("Enter an amount.");
    else if (requestedAmount <= 0) problems.push("The amount must be greater than zero.");
    if (direction === "DEBIT" && requestedAmount > available) {
      problems.push(
        `That deduction is larger than the available balance. The most you can deduct is ${formatPoints(available)}.`,
      );
    }
    if (!reason.trim()) problems.push("A reason or reference is required.");
    return { ok: problems.length === 0, problems };
  }, [amount, requestedAmount, direction, available, reason]);

  const review = () => {
    if (!validation.ok) {
      setError(validation.problems[0] ?? "Please correct the form.");
      return;
    }
    setError(null);
    // One key per submission, so a double click or a retried request is
    // recognised by the server instead of being posted twice.
    setSubmissionKey(crypto.randomUUID());
    setStep("review");
  };

  const confirm = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);

    const outcome = await invokeFunction<AdjustmentResult>("admin-actions", {
      action: "adjust_points",
      memberId: selected.id,
      points: requestedAmount,
      direction,
      reason: reason.trim(),
      idempotencyKey: submissionKey,
    });
    setSaving(false);

    const result = outcome.data as AdjustmentResult | undefined;

    if (!outcome.ok) {
      setError(outcome.error ?? "The adjustment could not be saved");
      setStep("form");
      await refresh();
      return;
    }

    if (result?.status === "DUPLICATE") {
      toast.info("This adjustment was already posted", {
        description: result.reasonText ?? "Nothing was changed a second time.",
      });
      setStep("form");
      setAmount("");
      setReason("");
      setSubmissionKey(null);
      await refresh();
      return;
    }

    if (result?.status !== "ADJUSTED") {
      setError(result?.reasonText ?? "The adjustment was refused.");
      setStep("form");
      await refresh();
      return;
    }

    toast.success(
      result.direction === "CREDIT" ? "Unilevel Points added" : "Unilevel Points deducted",
      {
        description: `${result.transactionId} · ${formatPoints(result.balanceBefore)} → ${formatPoints(
          result.balanceAfter,
        )} points for ${result.memberCode ?? selected.member_code}.`,
      },
    );

    setStep("form");
    setAmount("");
    setReason("");
    setSubmissionKey(null);
    await refresh();
  };

  const columns: Column<PointLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "txn",
      header: "Transaction ID",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => {
        const descriptor = transactionType(row.transaction_type);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "points",
      header: "Points",
      cell: (row) => (
        <span
          className={`font-semibold tabular-nums ${
            row.direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"
          }`}
        >
          {row.direction === "CREDIT" ? "+" : "-"}
          {formatPoints(row.total_points)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "balance",
      header: "Balance after",
      cell: (row) =>
        row.balance_after === null ? (
          <span className="text-muted-foreground">{"\u2014"}</span>
        ) : (
          <span className="tabular-nums">{formatPoints(row.balance_after)}</span>
        ),
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
    {
      key: "actor",
      header: "Administrator",
      cell: (row) => (
        <span className="text-xs">
          {row.processed_by ? (actorNames[row.processed_by] ?? "Administrator") : "System"}
        </span>
      ),
    },
    {
      key: "note",
      header: "Reason",
      cell: (row) => <span className="text-xs">{row.note ?? "\u2014"}</span>,
    },
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
                  <p className="kmd-label">Available Unilevel Points</p>
                  {loadingBalances ? (
                    <Skeleton className="mt-1 h-7 w-24" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold tabular-nums">{formatPoints(available)}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {loadingBalances
                      ? "Reading the ledger…"
                      : `Total ${formatPoints(balances?.unilevelPoints ?? 0)}${
                          held > 0 ? ` · ${formatPoints(held)} held for redemptions` : ""
                        }`}
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="kmd-label">Recent Unilevel transactions</p>
              </div>

              {loadingLedger ? (
                <div className="mt-3 space-y-2">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-8 w-full" />
                  ))}
                </div>
              ) : ledger.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No Unilevel point transactions for this member yet.
                </p>
              ) : (
                <ul className="mt-2 divide-y">
                  {ledger.slice(0, 5).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
                      <span className="truncate">{row.note ?? row.product_name ?? row.trigger_event ?? "\u2014"}</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          row.direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"
                        }`}
                      >
                        {row.direction === "CREDIT" ? "+" : "-"}
                        {formatPoints(row.total_points)}
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
              icon={Coins}
              title="Choose a member to begin"
              description="Search above, then add or deduct Unilevel Points with a recorded reason."
            />
          ) : step === "form" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Adjust Unilevel Points</h2>
              </div>

              <div className="space-y-2">
                <Label>Adjustment type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={direction === "CREDIT" ? "default" : "outline"}
                    onClick={() => setDirection("CREDIT")}
                  >
                    <Plus className="h-4 w-4" />
                    Credit (add)
                  </Button>
                  <Button
                    type="button"
                    variant={direction === "DEBIT" ? "destructive" : "outline"}
                    onClick={() => setDirection("DEBIT")}
                  >
                    <Minus className="h-4 w-4" />
                    Debit (deduct)
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="points-adjustment-amount">Points</Label>
                <Input
                  id="points-adjustment-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">
                  Available {formatPoints(available)}. A deduction can never exceed the available
                  balance.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="points-adjustment-reason">Reason or reference</Label>
                <Textarea
                  id="points-adjustment-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  placeholder="Why this adjustment is being made (stored on the ledger entry and the audit log)"
                />
              </div>

              <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Available Unilevel Points</dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(available)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {direction === "CREDIT" ? "Crediting" : "Debiting"}
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatPoints(requestedAmount)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground">Resulting available balance</dt>
                  <dd
                    className={`font-bold tabular-nums ${
                      resultingAvailable < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatPoints(resultingAvailable)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total points after</dt>
                  <dd className="tabular-nums text-muted-foreground">{formatPoints(resultingTotal)}</dd>
                </div>
              </dl>

              {!validation.ok && (amount.trim().length > 0 || reason.trim().length > 0) ? (
                <ul className="space-y-1 text-[11px] text-destructive">
                  {validation.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}

              <Button className="w-full" onClick={review} disabled={!validation.ok || loadingBalances}>
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
                    <span className="text-muted-foreground">Adjustment type</span>
                    <StatusBadge
                      label={direction === "CREDIT" ? "Credit (add points)" : "Debit (deduct points)"}
                      tone={direction === "CREDIT" ? "success" : "danger"}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Points</span>
                    <span className="font-semibold tabular-nums">{formatPoints(requestedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Available balance</span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">
                      {formatPoints(available)}
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span
                        className={
                          direction === "CREDIT" ? "text-[hsl(var(--success))]" : "text-destructive"
                        }
                      >
                        {formatPoints(resultingAvailable)}
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
                This writes one new Unilevel point ledger entry, recording the member, the type, the
                amount, the previous and resulting balance, the reason, your administrator account and
                the time. Rewards, wallet balances, orders and payments are not affected.
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
          <h2 className="text-base font-semibold">Unilevel transaction history</h2>
          <DataTable
            columns={columns}
            rows={ledger}
            rowKey={(row) => row.id}
            loading={loadingLedger}
            empty={
              <EmptyState
                icon={History}
                title="No Unilevel transactions"
                description="Adjustments, purchase bonuses, conversions and reversals all appear here once they exist."
              />
            }
          />
        </section>
      ) : null}
    </div>
  );
}
