import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge, type Tone } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/kmd/format";
import type { TestResultRow } from "@/lib/kmd/types";

interface ChainEntry {
  label: string;
  testKey: string;
  pendingConfiguration?: boolean;
}

/** The acceptance chain from the build brief, mapped to the recorded tests. */
const CHAIN: ChainEntry[] = [
  { label: "Purchase Record", testKey: "test_1_qualification_timing" },
  { label: "Payment Trigger", testKey: "test_1_qualification_timing" },
  { label: "Product/SKU", testKey: "test_3_quantity" },
  { label: "Sponsor Tree", testKey: "test_5_broken_transaction" },
  { label: "Level 1 Reward", testKey: "test_3_quantity" },
  { label: "Level 2 Reward", testKey: "test_1_qualification_timing" },
  { label: "Level 3 Reward", testKey: "test_1_qualification_timing", pendingConfiguration: true },
  { label: "Level 4 Reward", testKey: "test_1_qualification_timing", pendingConfiguration: true },
  { label: "Level 5 Reward", testKey: "test_1_qualification_timing", pendingConfiguration: true },
  { label: "Loyalty Credit", testKey: "test_6_loyalty_credit" },
  { label: "Membership Activation", testKey: "test_14_membership_activation" },
  { label: "Point Ledger", testKey: "test_3_quantity" },
  { label: "Duplicate Protection", testKey: "test_2_duplicate_confirmation" },
  { label: "Balance", testKey: "test_6_loyalty_credit" },
  { label: "Dashboard", testKey: "test_6_loyalty_credit" },
  { label: "Redemption", testKey: "test_7_redemption_limits" },
];

const VERDICT_TONE: Record<string, Tone> = {
  PASS: "success",
  FAIL: "danger",
  BLOCKED: "warning",
};

export default function AdminVerificationReport() {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TestResultRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("test_results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) console.error("Could not load the recorded test results:", error.message);
    setRows((data ?? []) as unknown as TestResultRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  /** Only the most recent run is reported. */
  const latestRun = useMemo(() => {
    if (rows.length === 0) return null;
    const newest = rows[0];
    const runRows = rows.filter((row) => row.run_id === newest.run_id);
    return {
      runId: newest.run_id,
      createdAt: newest.created_at,
      results: runRows,
      passed: runRows.filter((row) => row.verdict === "PASS").length,
      total: runRows.length,
    };
  }, [rows]);

  const runTests = async (action: "seed-test-environment" | "run-required-tests") => {
    setBusy(action);
    const outcome = await invokeFunction<Record<string, unknown>>(action, {});
    setBusy(null);

    if (!outcome.ok) {
      toast.error("The action did not complete", { description: outcome.error });
      return;
    }
    toast.success(
      action === "seed-test-environment" ? "Test environment ready" : "Required tests executed",
    );
    await load();
  };

  const columns: Column<TestResultRow>[] = [
    { key: "test", header: "Test", cell: (row) => <span className="text-sm font-medium">{row.test_name}</span> },
    { key: "expected", header: "Expected", cell: (row) => <span className="text-xs text-muted-foreground">{row.expected ?? "\u2014"}</span> },
    { key: "actual", header: "Actual evidence", cell: (row) => <span className="text-xs">{row.actual ?? "\u2014"}</span> },
    {
      key: "verdict",
      header: "Verdict",
      cell: (row) => <StatusBadge label={row.verdict} tone={VERDICT_TONE[row.verdict] ?? "neutral"} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Verification Report"
        description="The recorded acceptance evidence. Every verdict comes from real database records — a failing test is reported, never hidden."
        actions={
          isSuperAdmin ? (
            <>
              <Button
                variant="outline"
                onClick={() => void runTests("seed-test-environment")}
                disabled={busy !== null}
              >
                {busy === "seed-test-environment" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Seed test environment
              </Button>
              <Button onClick={() => void runTests("run-required-tests")} disabled={busy !== null}>
                {busy === "run-required-tests" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run required tests
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              Only a super administrator can run the acceptance tests.
            </span>
          )
        }
      />

      {loading ? (
        <div className="kmd-panel space-y-3 p-6">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : !latestRun ? (
        <div className="kmd-panel">
          <EmptyState
            icon={BookOpenCheck}
            title="The required tests have not been run yet"
            description="Seed the test environment first, then run the required tests. The results are written to the database and reported here."
          />
          {isSuperAdmin ? (
            <div className="flex justify-center gap-2 pb-6">
              <Button variant="outline" onClick={() => void runTests("seed-test-environment")} disabled={busy !== null}>
                Seed test environment
              </Button>
              <Button onClick={() => void runTests("run-required-tests")} disabled={busy !== null}>
                Run required tests
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Recorded Run"
              value={`${latestRun.passed} / ${latestRun.total}`}
              hint={formatDateTime(latestRun.createdAt)}
              icon={BookOpenCheck}
              accent={latestRun.passed === latestRun.total ? "success" : "gold"}
            />
            <StatCard
              label="Verdict"
              value={latestRun.passed === latestRun.total ? "All passing" : "Attention needed"}
              hint={`Run ${latestRun.runId.slice(0, 8)}`}
              accent={latestRun.passed === latestRun.total ? "success" : "primary"}
            />
            <StatCard
              label="Tests Recorded"
              value={String(latestRun.total)}
              hint="Required tests 1 to 7"
              accent="platinum"
            />
          </div>

          <div className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Final acceptance chain</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Each row is derived from the recorded evidence below it. A row marked "awaiting
              configuration" is not a failure: the engine traced that level, but its value is
              deliberately 0 until an administrator enters it in Reward Configuration.
            </p>

            <ul className="mt-4 space-y-2">
              {CHAIN.map((entry) => {
                const result = latestRun.results.find((row) => row.test_key === entry.testKey);
                const tone: Tone = entry.pendingConfiguration
                  ? "warning"
                  : result
                    ? (VERDICT_TONE[result.verdict] ?? "neutral")
                    : "neutral";
                const label = entry.pendingConfiguration
                  ? "Awaiting configuration"
                  : (result?.verdict ?? "Not covered");
                const Icon = entry.pendingConfiguration
                  ? AlertTriangle
                  : result?.verdict === "PASS"
                    ? CheckCircle2
                    : XCircle;

                return (
                  <li
                    key={entry.label}
                    className="flex flex-col gap-1 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-2.5">
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          tone === "success"
                            ? "text-[hsl(var(--success))]"
                            : tone === "danger"
                              ? "text-destructive"
                              : "text-[hsl(var(--warning))]"
                        }`}
                      />
                      <div>
                        <p className="text-sm font-medium">{entry.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {result ? `Evidence: ${result.actual}` : "Not covered by the recorded run"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label={label} tone={tone} />
                  </li>
                );
              })}
            </ul>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Recorded tests</h2>
            <DataTable
              columns={columns}
              rows={latestRun.results}
              rowKey={(row) => row.id}
              loading={false}
              empty={<EmptyState icon={BookOpenCheck} title="No results" />}
            />
          </section>

          <div className="kmd-panel border-dashed p-4">
            <p className="text-xs text-muted-foreground">
              The report reads the latest recorded run from the database. Running the tests again creates
              new orders and new ledger rows, all flagged as test data, and appends a new run.
            </p>
          </div>
        </>
      )}
    </>
  );
}
