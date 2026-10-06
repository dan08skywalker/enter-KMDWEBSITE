import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { MemberCell } from "@/components/kmd/member-cell";
import { FilterBar, SearchInput } from "@/components/kmd/filter-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatPoints, toNumber } from "@/lib/kmd/format";
import { accountStatus } from "@/lib/kmd/labels";
import type { Profile } from "@/lib/kmd/types";

export default function AdminRetailers() {
  const [loading, setLoading] = useState(true);
  const [retailers, setRetailers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteQuery, setPromoteQuery] = useState("");
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("*")
      .eq("account_type", "retailer")
      .order("registration_date", { ascending: false });
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) console.error("Could not load retailers:", error.message);
    setRetailers((data ?? []) as unknown as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["profiles"], () => void load());

  const searchCandidates = async (term: string) => {
    setPromoteQuery(term);
    if (term.trim().length < 2) {
      setCandidates([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, member_code, username, account_type")
      .eq("account_type", "member")
      .or(`member_code.ilike.%${term.trim()}%,username.ilike.%${term.trim()}%,first_name.ilike.%${term.trim()}%`)
      .limit(8);
    if (error) {
      console.error("Member search failed:", error.message);
      return;
    }
    setCandidates((data ?? []) as unknown as Profile[]);
  };

  const promote = async () => {
    if (!selected) {
      toast.error("Select the member to promote");
      return;
    }
    setBusy(true);

    const typeOutcome = await invokeFunction<{ ok?: boolean }>("admin-actions", {
      action: "set_account_type",
      memberId: selected.id,
      accountType: "retailer",
    });
    if (!typeOutcome.ok) {
      setBusy(false);
      toast.error("Could not promote the member", { description: typeOutcome.error });
      return;
    }

    const roleOutcome = await invokeFunction<{ ok?: boolean }>("admin-actions", {
      action: "set_role",
      memberId: selected.id,
      role: "retailer",
    });
    setBusy(false);

    if (!roleOutcome.ok) {
      toast.error("Account type changed but the retailer role was not granted", {
        description: roleOutcome.error,
      });
    } else {
      toast.success(`${selected.member_code} is now a retailer`);
    }

    setPromoteOpen(false);
    setSelected(null);
    setPromoteQuery("");
    setCandidates([]);
    await load();
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return retailers;
    return retailers.filter((row) =>
      `${row.member_code} ${row.username} ${row.first_name} ${row.last_name}`
        .toLowerCase()
        .includes(needle),
    );
  }, [retailers, search]);

  const totalPoints = retailers.reduce((sum, row) => sum + toNumber(row.unilevel_points_balance), 0);
  const activeCount = retailers.filter((row) => row.account_status === "active").length;

  const columns: Column<Profile>[] = [
    { key: "member", header: "Retailer", cell: (row) => <MemberCell profile={row} showStatus /> },
    { key: "sponsor", header: "Sponsor", cell: (row) => <span className="font-mono text-xs">{row.sponsor_code ?? "\u2014"}</span> },
    {
      key: "points",
      header: "Unilevel Points",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.unilevel_points_balance)}</span>,
      className: "text-right",
    },
    {
      key: "loyalty",
      header: "Loyalty Credits",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.loyalty_credits_balance)}</span>,
      className: "text-right",
    },
    {
      key: "lifetime",
      header: "Lifetime Earnings",
      cell: (row) => <span className="tabular-nums">{formatPoints(row.total_lifetime_earnings)}</span>,
      className: "text-right",
    },
    { key: "activated", header: "Activated", cell: (row) => formatDate(row.activation_date) },
  ];

  return (
    <>
      <PageHeader
        title="Retailers"
        description="Members carrying the retailer account type. Retailers keep the same ledger and genealogy rules as members."
        actions={
          <Button onClick={() => setPromoteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Promote a member
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Retailers" value={String(retailers.length)} icon={BadgePercent} accent="primary" loading={loading} />
        <StatCard label="Active Retailers" value={String(activeCount)} accent="success" loading={loading} />
        <StatCard label="Points Held by Retailers" value={formatPoints(totalPoints)} accent="gold" loading={loading} />
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search retailer, member ID or username" />
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Switch id="retailers-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
          <Label htmlFor="retailers-include-test" className="cursor-pointer text-xs">
            Include test data
          </Label>
        </div>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={BadgePercent}
            title="No retailers yet"
            description="Promote a member to give them the retailer account type and role."
          />
        }
      />

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote a member to retailer</DialogTitle>
            <DialogDescription>
              This sets the account type to retailer and grants the retailer role. Both changes are
              written to the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="promote-search">Find a member</Label>
              <Input
                id="promote-search"
                value={promoteQuery}
                onChange={(event) => void searchCandidates(event.target.value)}
                placeholder="Search by member ID, username or first name"
              />
            </div>

            {candidates.length > 0 ? (
              <ul className="max-h-48 overflow-y-auto rounded-lg border kmd-scroll">
                {candidates.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(candidate)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted ${
                        selected?.id === candidate.id ? "bg-muted" : ""
                      }`}
                    >
                      <span>
                        {candidate.first_name} {candidate.last_name}
                      </span>
                      <span className="font-mono text-muted-foreground">{candidate.member_code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {selected ? (
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                <span>
                  Selected: {selected.first_name} {selected.last_name}
                </span>
                <StatusBadge label={accountStatus("active").label} tone="success" />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void promote()} disabled={busy || !selected}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Promote to retailer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
