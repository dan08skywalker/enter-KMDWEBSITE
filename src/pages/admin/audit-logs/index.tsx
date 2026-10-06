import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { formatDateTime } from "@/lib/kmd/format";
import { auditAction } from "@/lib/kmd/labels";
import type { AuditLogRow } from "@/lib/kmd/types";

/** Renders a small before/after value map as readable chips instead of raw JSON. */
function ValueChange({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="text-muted-foreground">{"\u2014"}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {Object.entries(value).map(([key, entry]) => (
        <span key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
          {key}: {typeof entry === "object" ? JSON.stringify(entry) : String(entry)}
        </span>
      ))}
    </span>
  );
}

export default function AdminAuditLogs() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(400);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) console.error("Could not load audit logs:", error.message);
    setRows((data ?? []) as unknown as AuditLogRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["audit_logs"], () => void load());

  const actionOptions = useMemo(() => {
    const distinct = Array.from(new Set(rows.map((row) => row.action)));
    return distinct.map((value) => ({ value, label: auditAction(value).label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;

    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (action !== "all" && row.action !== action) return false;
      if (needle) {
        const haystack = `${row.actor_member_code ?? ""} ${row.actor_username ?? ""} ${
          row.target_member_code ?? ""
        } ${row.reason ?? ""} ${row.entity ?? ""} ${row.entity_id ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, action, from, search]);

  const columns: Column<AuditLogRow>[] = [
    {
      key: "expand",
      header: "",
      cell: (row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Toggle details"
          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
        >
          {expanded === row.id ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      ),
    },
    { key: "date", header: "Date/Time", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "auditId",
      header: "Audit ID",
      cell: (row) => <span className="font-mono text-[11px]">{row.id.slice(0, 8)}</span>,
    },
    {
      key: "actor",
      header: "Administrator",
      cell: (row) => (
        <span className="text-xs">
          {row.actor_member_code ?? "\u2014"}
          <br />
          <span className="text-muted-foreground">{row.actor_username ?? "system"}</span>
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      cell: (row) => {
        const descriptor = auditAction(row.action);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    {
      key: "member",
      header: "Member",
      cell: (row) => <span className="font-mono text-xs">{row.target_member_code ?? "\u2014"}</span>,
    },
    {
      key: "order",
      header: "Order",
      cell: (row) => (
        <span className="font-mono text-[11px]">{row.order_id ? `${row.order_id.slice(0, 8)}\u2026` : "\u2014"}</span>
      ),
    },
    {
      key: "change",
      header: "Change",
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <ValueChange label="was" value={row.previous_value} />
          <ValueChange label="now" value={row.new_value} />
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => <span className="text-xs text-muted-foreground">{row.reason ?? "\u2014"}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Every sensitive action, recorded permanently. Corrections are added as new entries — history is never edited or deleted."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="audit-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="audit-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search administrator, member, entity or reason" />
        <div className="space-y-1">
          <Label htmlFor="audit-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            From
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-[160px]"
          />
        </div>
        <SelectFilter
          value={action}
          onChange={setAction}
          allLabel="All actions"
          options={actionOptions}
          className="sm:w-[230px]"
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{filtered.length}</span> audit entries
        </span>
        <span>Expand any row to inspect the recorded before and after values.</span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={FileClock}
            title="No audit entries"
            description="Sensitive actions such as payment confirmation, membership activation, sponsor changes and reward configuration updates are recorded here."
          />
        }
      />

      {expanded ? (
        <div className="kmd-panel p-5">
          {(() => {
            const row = rows.find((entry) => entry.id === expanded);
            if (!row) return null;
            return (
              <>
                <h2 className="text-sm font-semibold">
                  {auditAction(row.action).label} &middot;{" "}
                  <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.entity ?? "record"} {row.entity_id ? `\u00b7 ${row.entity_id}` : ""} &middot;{" "}
                  {formatDateTime(row.created_at)}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="kmd-label">Previous value</p>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-[11px] kmd-scroll">
                      {JSON.stringify(row.previous_value ?? {}, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="kmd-label">New value</p>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/50 p-3 text-[11px] kmd-scroll">
                      {JSON.stringify(row.new_value ?? {}, null, 2)}
                    </pre>
                  </div>
                </div>
                {row.reason ? (
                  <p className="mt-4 text-xs">
                    <span className="kmd-label">Reason</span>
                    <span className="mt-1 block">{row.reason}</span>
                  </p>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </>
  );
}
