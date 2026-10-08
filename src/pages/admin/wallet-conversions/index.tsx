import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, RefreshCw } from "lucide-react";
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
import { CONVERSION_DIRECTIONS } from "@/lib/kmd/conversion";
import { formatDateTime, formatPoints, toNumber } from "@/lib/kmd/format";
import type { WalletConversion } from "@/lib/kmd/types";

interface Row extends WalletConversion {
  memberName: string | null;
}

/**
 * Administrator view of every balance conversion between the Shopping Wallet and
 * Unilevel Points, with the rate and fee each member was charged.
 */
export default function AdminWalletConversions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  const load = async () => {
    setLoading(true);

    let query = supabase
      .from("wallet_conversions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) {
      console.error("Could not load the conversions:", error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const conversions = (data ?? []) as unknown as WalletConversion[];
    const memberIds = Array.from(new Set(conversions.map((row) => row.member_id)));

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

    setRows(conversions.map((row) => ({ ...row, memberName: names.get(row.member_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["wallet_conversions"], () => void load());

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;

    return rows.filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (fromTime !== null && at < fromTime) return false;
      if (direction !== "all" && row.direction !== direction) return false;
      if (status !== "all" && row.status !== status) return false;
      if (needle) {
        const haystack = `${row.reference} ${row.member_code} ${row.memberName ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, direction, status, from, search]);

  const totals = useMemo(
    () => ({
      deducted: filtered.reduce((sum, row) => sum + toNumber(row.amount_deducted), 0),
      credited: filtered.reduce((sum, row) => sum + toNumber(row.amount_credited), 0),
      fees: filtered.reduce((sum, row) => sum + toNumber(row.fee_amount), 0),
    }),
    [filtered],
  );

  const columns: Column<Row>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "reference",
      header: "Reference",
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
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
      key: "direction",
      header: "Direction",
      cell: (row) => (
        <StatusBadge
          label={CONVERSION_DIRECTIONS[row.direction]?.label ?? row.direction}
          tone={row.direction === "POINTS_TO_WALLET" ? "gold" : "platinum"}
        />
      ),
    },
    {
      key: "deducted",
      header: "Deducted",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.amount_deducted)}</span>,
      className: "text-right",
    },
    {
      key: "credited",
      header: "Credited",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.amount_credited)}</span>,
      className: "text-right",
    },
    {
      key: "rate",
      header: "Rate",
      cell: (row) => <span className="tabular-nums">{row.rate}</span>,
      className: "text-right",
    },
    {
      key: "fee",
      header: "Fee",
      cell: (row) => (
        <span className="tabular-nums">
          {formatPoints(row.fee_amount)}
          {row.fee_percent > 0 ? ` (${row.fee_percent}%)` : ""}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          label={row.status === "posted" ? "Posted" : "Reversed"}
          tone={row.status === "posted" ? "success" : "danger"}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Wallet Conversions"
        description="Every conversion between members' Shopping Wallet balance and their Available Unilevel Points, with the rate and fee applied."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Conversions follow the <span className="font-semibold">Wallet conversion rate</span> and{" "}
          <span className="font-semibold">Wallet conversion fee</span> in Settings. If the rate is unset a
          member cannot convert at all. Each conversion writes a matched pair of ledger entries — one
          debit, one credit — in a single transaction, and nothing is ever moved partially.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="conversions-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="conversions-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search reference, member name or member ID" />
        <div className="space-y-1">
          <Label htmlFor="conversions-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">
            From
          </Label>
          <Input
            id="conversions-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-[160px]"
          />
        </div>
        <SelectFilter
          value={direction}
          onChange={setDirection}
          allLabel="All directions"
          options={[
            { value: "POINTS_TO_WALLET", label: "Points → Wallet" },
            { value: "WALLET_TO_POINTS", label: "Wallet → Points" },
          ]}
          className="sm:w-[190px]"
        />
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "posted", label: "Posted" },
            { value: "reversed", label: "Reversed" },
          ]}
        />
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <ArrowRightLeft className="mr-1 inline h-3 w-3" />
          <span className="font-semibold text-foreground">{filtered.length}</span> conversions
        </span>
        <span>
          Deducted <span className="font-semibold text-foreground">{formatPoints(totals.deducted)}</span>
        </span>
        <span>
          Credited <span className="font-semibold text-foreground">{formatPoints(totals.credited)}</span>
        </span>
        <span>
          Fees <span className="font-semibold text-foreground">{formatPoints(totals.fees)}</span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={ArrowRightLeft}
            title="No conversions yet"
            description="Member balance conversions appear here once they are made."
          />
        }
      />
    </>
  );
}
