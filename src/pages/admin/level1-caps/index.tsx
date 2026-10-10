import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";

interface CapRow {
  packageId: string;
  packageCode: string;
  packageName: string;
  tier: string;
  capAmount: number | null;
  capped: boolean;
  capUpdatedAt: string | null;
  capUpdatedByCode: string | null;
  membersOnPackage: number;
  level1MatrixPoints: number | null;
}

interface DuplicateGroup {
  normalized: string;
  count: number;
  members: Array<{ memberCode: string; memberId: string; storedValue: string; status: string }>;
}

interface DuplicateReport {
  phones: DuplicateGroup[];
  emails: DuplicateGroup[];
}

interface AuditRow {
  id: string;
  action: string;
  actor_member_code: string | null;
  new_value: Record<string, unknown> | null;
  previous_value: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Level 1 earning caps.
 *
 * The cap belongs to the package of the sponsor RECEIVING the Level 1 commission,
 * so a Classic sponsor earns at most the Classic cap on any single qualifying
 * purchase. Gold and Platinum carry no cap and keep the reward matrix amount.
 * Levels 2 to 5 are not affected by anything on this screen.
 */
export default function AdminLevel1Caps() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CapRow[]>([]);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateReport | null>(null);
  const [duplicatesLoading, setDuplicatesLoading] = useState(true);
  const [target, setTarget] = useState<CapRow | null>(null);
  const [capDraft, setCapDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const outcome = await invokeFunction<{ result?: { packages?: CapRow[] } }>("admin-actions", {
      action: "level1_caps",
    });
    setLoading(false);

    if (!outcome.ok) {
      console.error("Could not load the Level 1 caps:", outcome.error);
      setRows([]);
      return;
    }
    setRows(outcome.data?.result?.packages ?? []);

    // History of who changed a cap, and when.
    const { data, error: auditError } = await supabase
      .from("audit_logs")
      .select("id, action, actor_member_code, new_value, previous_value, created_at")
      .eq("action", "LEVEL1_CAP_CHANGE")
      .order("created_at", { ascending: false })
      .limit(5);
    if (auditError) console.error("Could not load the cap history:", auditError.message);
    setHistory((data ?? []) as unknown as AuditRow[]);
  }, []);

  const loadDuplicates = useCallback(async () => {
    setDuplicatesLoading(true);
    const outcome = await invokeFunction<{ result?: DuplicateReport }>("admin-actions", {
      action: "duplicate_contacts",
    });
    setDuplicatesLoading(false);
    if (!outcome.ok) {
      console.error("Could not load the duplicate contacts:", outcome.error);
      setDuplicates(null);
      return;
    }
    setDuplicates(outcome.data?.result ?? null);
  }, []);

  useEffect(() => {
    void load();
    void loadDuplicates();
  }, [load, loadDuplicates]);

  const openEditor = (row: CapRow) => {
    setError(null);
    setCapDraft(row.capAmount === null ? "" : String(row.capAmount));
    setTarget(row);
  };

  const save = async () => {
    if (!target) return;
    const trimmed = capDraft.trim();
    if (trimmed.length > 0) {
      const parsed = toNumber(trimmed, NaN);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Enter a cap of zero or more, or leave it empty for no cap.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    const outcome = await invokeFunction<{
      result?: { status?: string; capAmount?: number | null; previousCapAmount?: number | null; reasonText?: string };
    }>("admin-actions", {
      action: "set_level1_cap",
      packageId: target.packageId,
      capAmount: trimmed.length === 0 ? null : toNumber(trimmed),
    });
    setBusy(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The cap could not be saved.");
      return;
    }
    const result = outcome.data?.result;
    if (result?.status !== "UPDATED") {
      setError(result?.reasonText ?? "The cap was refused.");
      return;
    }

    toast.success("Level 1 cap updated", {
      description:
        `${target.packageCode}: ` +
        `${result.previousCapAmount === null || result.previousCapAmount === undefined ? "no cap" : formatPeso(result.previousCapAmount)} → ` +
        `${result.capAmount === null ? "no cap" : formatPeso(result.capAmount)}. ` +
        "Only future qualifying purchases are affected; credited earnings are unchanged.",
    });
    setTarget(null);
    await load();
  };

  const capColumns: Column<CapRow>[] = [
    {
      key: "package",
      header: "Receiving sponsor's package",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{row.packageName}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{row.packageCode}</span>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      cell: (row) => <StatusBadge label={row.tier} tone="info" />,
    },
    {
      key: "members",
      header: "Members on it",
      cell: (row) => <span className="tabular-nums">{row.membersOnPackage}</span>,
      className: "text-right",
    },
    {
      key: "matrix",
      header: "Matrix Level 1",
      cell: (row) => (
        <span className="tabular-nums">
          {row.level1MatrixPoints === null ? "\u2014" : formatPoints(row.level1MatrixPoints)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "cap",
      header: "Level 1 cap",
      cell: (row) => (
        <span className={row.capped ? "font-semibold tabular-nums" : "text-muted-foreground"}>
          {row.capped ? formatPeso(row.capAmount) : "No cap — matrix applies"}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "updated",
      header: "Last changed",
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {row.capUpdatedAt
            ? `${formatDateTime(row.capUpdatedAt)}${row.capUpdatedByCode ? ` · ${row.capUpdatedByCode}` : ""}`
            : "\u2014"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => openEditor(row)}>
          <ShieldCheck className="h-3 w-3" />
          Edit cap
        </Button>
      ),
    },
  ];

  const duplicateList = (groups: DuplicateGroup[] | undefined, kind: "phone" | "email") => (
    <div className="space-y-3">
      {(groups ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No duplicate {kind === "phone" ? "phone numbers" : "email addresses"} found. Review only —
          accounts are never merged or deleted automatically.
        </p>
      ) : (
        (groups ?? []).map((group) => (
          <div key={group.normalized} className="kmd-panel border-warning/40 bg-warning/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
              {group.normalized} · {group.count} accounts
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {group.members.map((member) => (
                <li key={member.memberId} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{member.memberCode}</span>
                  <span className="text-muted-foreground">stored as {member.storedValue}</span>
                  <StatusBadge label={member.status} tone={member.status === "active" ? "success" : "neutral"} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Level 1 Earning Caps"
        description="The most a sponsor can earn at Level 1 on a single qualifying purchase, based on the package they hold. Levels 2 to 5 always follow the reward matrix."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void load();
              void loadDuplicates();
            }}
            disabled={loading}
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <Tabs defaultValue="caps">
        <TabsList>
          <TabsTrigger value="caps">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Level 1 Earning Caps
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Duplicate Contacts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="caps" className="mt-4 space-y-4">
          <div className="kmd-panel border-dashed p-4">
            <p className="text-xs text-muted-foreground">
              The cap is taken from the package of the sponsor <strong>receiving</strong> the Level 1
              commission, not the package the referred member bought. The final commission is the lower
              of the matrix amount and the cap, so a cap never increases a smaller commission. Caps are
              per qualifying purchase — not daily, monthly or lifetime limits. Changing a cap affects
              future qualifying purchases only; earnings already credited are never recalculated.
            </p>
          </div>

          <DataTable
            columns={capColumns}
            rows={rows}
            rowKey={(row) => row.packageId}
            loading={loading}
            empty={
              <EmptyState
                icon={ShieldCheck}
                title="No membership packages found"
                description="Caps are configured per membership package."
              />
            }
          />

          {history.length > 0 ? (
            <div className="kmd-panel p-4">
              <h2 className="text-sm font-semibold">Recent cap changes</h2>
              <ul className="mt-2 space-y-2 text-xs">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                    <span className="font-mono">{entry.actor_member_code ?? "administrator"}</span>
                    <span>
                      {String(entry.new_value?.packageCode ?? "")}:{" "}
                      {entry.previous_value?.capAmount === null ||
                      entry.previous_value?.capAmount === undefined
                        ? "no cap"
                        : formatPeso(entry.previous_value.capAmount)}
                      {" → "}
                      {entry.new_value?.capAmount === null || entry.new_value?.capAmount === undefined
                        ? "no cap"
                        : formatPeso(entry.new_value.capAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="duplicates" className="mt-4 space-y-4">
          <div className="kmd-panel border-dashed p-4">
            <p className="text-xs text-muted-foreground">
              One email address and one phone number may belong to only one member account. New
              registrations and contact-detail edits are rejected on the backend, comparing phone
              numbers regardless of local or country-code formatting. The records below already existed
              before that rule, so they are listed for a human decision — nothing is merged or deleted
              automatically.
            </p>
          </div>

          {duplicatesLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Reading contact details…
            </p>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Duplicate phone numbers</h2>
                {duplicateList(duplicates?.phones, "phone")}
              </section>
              <section className="space-y-3">
                <h2 className="text-base font-semibold">Duplicate email addresses</h2>
                {duplicateList(duplicates?.emails, "email")}
              </section>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/members">Review members</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Level 1 cap</DialogTitle>
            <DialogDescription>
              {target ? `${target.packageName} (${target.packageCode})` : ""} — the most a sponsor on
              this package can earn at Level 1 from one qualifying purchase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <dl className="space-y-2 rounded-lg border p-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Matrix Level 1 amount</dt>
                <dd className="tabular-nums">
                  {target?.level1MatrixPoints === null || target?.level1MatrixPoints === undefined
                    ? "\u2014"
                    : formatPoints(target.level1MatrixPoints)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current cap</dt>
                <dd className="tabular-nums">
                  {target?.capped ? formatPeso(target.capAmount) : "No cap"}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <Label htmlFor="level1-cap">New cap</Label>
              <Input
                id="level1-cap"
                inputMode="decimal"
                value={capDraft}
                onChange={(event) => setCapDraft(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="Leave empty for no cap"
              />
              <p className="text-[11px] text-muted-foreground">
                Leave it empty so this package keeps the full reward matrix amount, as Gold and Platinum
                do.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy || !target}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Save cap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
