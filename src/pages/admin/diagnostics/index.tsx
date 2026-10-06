import { useState } from "react";
import { Activity, Loader2, RefreshCw, Search } from "lucide-react";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { DiagnosticsChecklist } from "@/components/kmd/diagnostics-checklist";
import { EngineResultPanel } from "@/components/kmd/engine-result";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, formatPoints } from "@/lib/kmd/format";
import { orderStatus } from "@/lib/kmd/labels";
import type { DiagnosticReport, EngineRunResult } from "@/lib/kmd/types";

interface DiagnosticsResponse {
  ok?: boolean;
  report?: DiagnosticReport;
}

export default function AdminDiagnostics() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [engineResult, setEngineResult] = useState<EngineRunResult | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const runDiagnostics = async (value?: string) => {
    const target = (value ?? identifier).trim();
    if (!target) {
      setLookupError("Enter an order or purchase ID.");
      setReport(null);
      return;
    }

    setBusy(true);
    setLookupError(null);
    const outcome = await invokeFunction<DiagnosticsResponse>("reward-diagnostics", {
      orderIdentifier: target,
    });
    setBusy(false);

    if (!outcome.ok || !outcome.data?.report) {
      setReport(null);
      setLookupError(outcome.error ?? "The diagnostics service did not return a report.");
      return;
    }

    setReport(outcome.data.report);
    setIdentifier(target);
    setRecent((previous) => [target, ...previous.filter((entry) => entry !== target)].slice(0, 6));
  };

  const retryProcessing = async (orderId: string, reason?: string) => {
    const outcome = await invokeFunction<{ ok?: boolean; result?: EngineRunResult }>("admin-actions", {
      action: "process_qualified_purchase",
      orderId,
      reason,
    });

    if (!outcome.ok) {
      return { error: outcome.error ?? "Reward processing failed" };
    }
    const result = outcome.data?.result ?? null;
    if (result) setEngineResult(result);
    await runDiagnostics(identifier);
    return {};
  };

  const failedChecks = report?.checks?.filter((check) => !check.passed) ?? [];
  const statusDescriptor = report?.orderStatus ? orderStatus(report.orderStatus) : null;

  return (
    <>
      <PageHeader
        title="Reward Engine Diagnostics"
        description="Trace one purchase through the whole reward pipeline. Every failing step reports the concrete reason, never a generic error."
      />

      <div className="kmd-panel p-5">
        <Label htmlFor="diagnostics-order">Order or purchase ID</Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="diagnostics-order"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runDiagnostics();
            }}
            placeholder="KMD-ORDER-001022 or the order UUID"
            className="font-mono text-sm"
          />
          <Button onClick={() => void runDiagnostics()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Run diagnostics
          </Button>
        </div>

        {recent.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent</span>
            {recent.map((entry) => (
              <Button
                key={entry}
                variant="outline"
                size="sm"
                className="h-6 px-2 font-mono text-[10px]"
                onClick={() => void runDiagnostics(entry)}
              >
                {entry}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          The checklist verifies the purchase row, payment confirmation, Product ID and SKU match, buyer
          record, the Level 1 to Level 5 sponsor trace, the points calculation, the point and loyalty
          ledger rows, the backend response and whether the displayed balances still agree with the
          ledger.
        </p>
      </div>

      {lookupError ? (
        <div className="kmd-panel border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">{lookupError}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check the order number or use the Orders page to open the purchase record.
          </p>
        </div>
      ) : null}

      {busy && !report ? (
        <div className="kmd-panel space-y-3 p-6">
          <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
          <div className="h-20 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : null}

      {!report && !busy && !lookupError ? (
        <div className="kmd-panel">
          <EmptyState
            icon={Activity}
            title="No order inspected yet"
            description="Enter an order number above to see the full reward pipeline for that purchase."
          />
        </div>
      ) : null}

      {report ? (
        report.found === false ? (
          <div className="kmd-panel border-destructive/40 bg-destructive/5 p-5">
            <p className="text-sm font-semibold text-destructive">{report.message}</p>
            <DiagnosticsChecklist checks={report.checks ?? []} className="mt-4" />
          </div>
        ) : (
          <>
            <div className="kmd-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="kmd-label">Order</p>
                  <p className="mt-1 font-mono text-lg font-bold">{report.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Buyer {report.buyerMemberCode}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {statusDescriptor ? (
                    <StatusBadge label={statusDescriptor.label} tone={statusDescriptor.tone} />
                  ) : null}
                  <StatusBadge
                    label={report.rewardsProcessed ? "Rewards processed" : "Rewards not processed"}
                    tone={report.rewardsProcessed ? "success" : "warning"}
                  />
                  {report.rewardsProcessedAt ? (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(report.rewardsProcessedAt)}
                    </span>
                  ) : null}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="kmd-label">Expected points</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {formatPoints(report.expectedPoints ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="kmd-label">Point ledger rows</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{report.ledgerRows ?? 0}</p>
                </div>
                <div>
                  <p className="kmd-label">Loyalty ledger rows</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{report.loyaltyRows ?? 0}</p>
                </div>
              </div>

              {failedChecks.length > 0 ? (
                <p className="mt-4 text-xs font-medium text-destructive">
                  {failedChecks.length} check{failedChecks.length > 1 ? "s" : ""} did not pass.
                </p>
              ) : (
                <p className="mt-4 text-xs font-medium text-[hsl(var(--success))]">
                  Every check passed for this order.
                </p>
              )}
            </div>

            <DiagnosticsChecklist checks={report.checks ?? []} />

            {report.orderStatus === "confirmed" && !report.rewardsProcessed ? (
              <div className="kmd-panel border-warning/40 bg-warning/5 p-5">
                <h2 className="text-sm font-semibold">Reward processing has not completed</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The order is confirmed but no reward run is recorded. Retry the engine once the reason
                  above is resolved. The engine is idempotent, so a retry can never pay a level twice.
                </p>
                <div className="mt-3">
                  <ConfirmActionDialog
                    trigger={
                      <Button size="sm" variant="secondary">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry reward processing
                      </Button>
                    }
                    title="Retry reward processing for this order?"
                    description="The engine traces Level 1 to Level 5, calculates each configured bonus and posts the ledger entries in one transaction."
                    confirmLabel="Retry now"
                    reasonRequired
                    reasonLabel="Reason for the retry"
                    onConfirm={(reason) => retryProcessing(report.orderId ?? "", reason)}
                  />
                </div>
              </div>
            ) : null}

            {engineResult ? (
              <div className="kmd-panel p-5">
                <h2 className="text-sm font-semibold">Reward engine result</h2>
                <EngineResultPanel result={engineResult} className="mt-3" />
              </div>
            ) : null}
          </>
        )
      ) : null}
    </>
  );
}
