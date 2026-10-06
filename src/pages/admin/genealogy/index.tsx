import { useCallback, useEffect, useMemo, useState } from "react";
import { ListTree, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { MemberCell } from "@/components/kmd/member-cell";
import { GenealogyTree, type GenealogyLevel, type GenealogyMember } from "@/components/kmd/genealogy-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/kmd/format";
import { accountStatus } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { AccountStatus, Profile } from "@/lib/kmd/types";

interface RelationRow {
  level: number;
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string | null;
    member_code: string;
    account_status: AccountStatus;
    activation_date: string | null;
    profile_photo_url: string | null;
    package_id: string | null;
  } | null;
}

function toGenealogyMember(profile: Profile): GenealogyMember {
  return {
    id: profile.id,
    member_code: profile.member_code,
    first_name: profile.first_name,
    last_name: profile.last_name,
    full_name: profile.full_name,
    account_status: profile.account_status,
    activation_date: profile.activation_date,
    profile_photo_url: profile.profile_photo_url,
    package_name: null,
  };
}

export default function AdminGenealogy() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [root, setRoot] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [downline, setDownline] = useState<GenealogyLevel[]>([]);
  const [upline, setUpline] = useState<Array<{ level: number; member: GenealogyMember }>>([]);
  const [levelFilter, setLevelFilter] = useState<"all" | number>("all");
  const [selected, setSelected] = useState<GenealogyMember | null>(null);

  const search = async (term: string) => {
    setQuery(term);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(
        `member_code.ilike.%${term.trim()}%,username.ilike.%${term.trim()}%,first_name.ilike.%${term.trim()}%,last_name.ilike.%${term.trim()}%`,
      )
      .limit(8);
    if (error) {
      console.error("Member search failed:", error.message);
      return;
    }
    setResults((data ?? []) as unknown as Profile[]);
  };

  const loadTree = useCallback(async (member: Profile) => {
    setLoading(true);
    setRoot(member);

    const [downResult, upResult] = await Promise.all([
      supabase
        .from("sponsor_relationships")
        .select(
          "level, profiles:descendant_id(id, first_name, last_name, full_name, member_code, account_status, activation_date, profile_photo_url, package_id)",
        )
        .eq("ancestor_id", member.id)
        .order("level", { ascending: true }),
      supabase
        .from("sponsor_relationships")
        .select(
          "level, profiles:ancestor_id(id, first_name, last_name, full_name, member_code, account_status, activation_date, profile_photo_url, package_id)",
        )
        .eq("descendant_id", member.id)
        .order("level", { ascending: false }),
    ]);

    if (downResult.error) console.error("Could not load the downline:", downResult.error.message);
    if (upResult.error) console.error("Could not load the upline:", upResult.error.message);

    const downRows = (downResult.data ?? []) as unknown as RelationRow[];
    const upRows = (upResult.data ?? []) as unknown as RelationRow[];

    setDownline(
      UNILEVEL_LEVELS.map((level) => ({
        level,
        members: downRows
          .filter((row) => row.level === level && row.profiles)
          .map((row) => ({
            id: row.profiles!.id,
            member_code: row.profiles!.member_code,
            first_name: row.profiles!.first_name,
            last_name: row.profiles!.last_name,
            full_name: row.profiles!.full_name,
            account_status: row.profiles!.account_status,
            activation_date: row.profiles!.activation_date,
            profile_photo_url: row.profiles!.profile_photo_url,
            package_name: null,
          })),
      })),
    );

    setUpline(
      upRows
        .filter((row) => row.profiles)
        .map((row) => ({
          level: row.level,
          member: {
            id: row.profiles!.id,
            member_code: row.profiles!.member_code,
            first_name: row.profiles!.first_name,
            last_name: row.profiles!.last_name,
            full_name: row.profiles!.full_name,
            account_status: row.profiles!.account_status,
            activation_date: row.profiles!.activation_date,
            profile_photo_url: row.profiles!.profile_photo_url,
            package_name: null,
          },
        })),
    );

    setResults([]);
    setQuery(member.member_code);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!root) return;
    // Selecting a node inside the tree re-roots the explorer on that member.
  }, [root]);

  const visibleLevels = useMemo(
    () => (levelFilter === "all" ? downline : downline.filter((level) => level.level === levelFilter)),
    [downline, levelFilter],
  );

  const selectedStatus = selected ? accountStatus(selected.account_status) : null;

  return (
    <>
      <PageHeader
        title="Genealogy"
        description="Trace any member's sponsor tree, Level 1 to Level 5, from the real Sponsor IDs stored in the database."
      />

      <div className="kmd-panel p-4">
        <label htmlFor="genealogy-search" className="kmd-label">
          Find a member
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="genealogy-search"
            value={query}
            onChange={(event) => void search(event.target.value)}
            placeholder="Search by member ID, username or name"
            className="pl-9"
          />
        </div>

        {results.length > 0 ? (
          <ul className="mt-3 divide-y rounded-lg border">
            {results.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => void loadTree(candidate)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                >
                  <MemberCell profile={candidate} />
                  <span className="text-[11px] text-muted-foreground">
                    {accountStatus(candidate.account_status).label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!root ? (
        <div className="kmd-panel">
          <EmptyState
            icon={ListTree}
            title="Choose a member to inspect"
            description="Search for a member above to load their five-level genealogy. Selecting any node in the tree makes that member the new root."
          />
        </div>
      ) : loading ? (
        <div className="kmd-panel space-y-4 p-6">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="kmd-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MemberCell profile={root} />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={levelFilter === "all" ? "default" : "outline"} onClick={() => setLevelFilter("all")}>
                  All levels
                </Button>
                {UNILEVEL_LEVELS.map((level) => (
                  <Button
                    key={level}
                    size="sm"
                    variant={levelFilter === level ? "default" : "outline"}
                    onClick={() => setLevelFilter(level)}
                  >
                    L{level}
                  </Button>
                ))}
              </div>
            </div>
            <Separator className="my-4" />
            <GenealogyTree levels={visibleLevels} onSelect={setSelected} />
          </div>

          <div className="kmd-panel">
            <div className="border-b px-5 py-4">
              <h2 className="text-sm font-semibold">Upline of {root.member_code}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                The sponsor chain that earns from this member's qualified purchases.
              </p>
            </div>
            {upline.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title="No sponsor on record"
                description="This member was registered without a sponsor, so no upline earns from their purchases."
              />
            ) : (
              <ul className="divide-y">
                {upline.map((entry) => (
                  <li key={entry.member.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <StatusBadge label={`Level ${entry.level}`} tone="gold" />
                      <MemberCell profile={{ ...entry.member, account_status: entry.member.account_status, profile_photo_url: entry.member.profile_photo_url ?? null }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Activated {formatDate(entry.member.activation_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.full_name ?? "Member"}</DialogTitle>
            <DialogDescription>Genealogy placement</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Member ID</span>
                <span className="font-mono">{selected.member_code}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Account status</span>
                {selectedStatus ? <StatusBadge label={selectedStatus.label} tone={selectedStatus.tone} /> : null}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Activation date</span>
                <span>{formatDate(selected.activation_date)}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
