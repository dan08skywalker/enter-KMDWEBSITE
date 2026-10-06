import { useEffect, useMemo, useState } from "react";
import { ListTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { GenealogyTree, type GenealogyLevel, type GenealogyMember } from "@/components/kmd/genealogy-tree";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/kmd/format";
import { accountStatus, packageTier } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { AccountStatus } from "@/lib/kmd/types";

interface Row {
  level: number;
  direct_sponsor_id: string | null;
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

export default function MemberGenealogy() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [packages, setPackages] = useState<Array<{ id: string; name: string; tier: string }>>([]);
  const [levelFilter, setLevelFilter] = useState<"all" | number>("all");
  const [selected, setSelected] = useState<GenealogyMember | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("sponsor_relationships")
      .select(
        "level, profiles:descendant_id(id, first_name, last_name, full_name, member_code, account_status, activation_date, profile_photo_url, package_id, direct_sponsor_id)",
      )
      .eq("ancestor_id", user.id)
      .order("level", { ascending: true });

    if (error) {
      console.error("Could not load the genealogy:", error.message);
      setLoading(false);
      return;
    }

    const built = (data ?? []) as unknown as Row[];
    setRows(built);

    const packageIds = Array.from(
      new Set(built.map((row) => row.profiles?.package_id).filter((id): id is string => Boolean(id))),
    );
    if (packageIds.length > 0) {
      const { data: packageRows } = await supabase
        .from("membership_packages")
        .select("id, name, tier")
        .in("id", packageIds);
      setPackages((packageRows ?? []) as unknown as Array<{ id: string; name: string; tier: string }>);
    } else {
      setPackages([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useRealtimeRefresh(["sponsor_relationships", "profiles"], () => void load());

  const levels: GenealogyLevel[] = useMemo(() => {
    const packageLookup = new Map(packages.map((pkg) => [pkg.id, pkg.name]));
    return UNILEVEL_LEVELS.map((level) => ({
      level,
      members: rows
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
          package_name: row.profiles!.package_id
            ? packageLookup.get(row.profiles!.package_id) ?? null
            : null,
        })),
    }));
  }, [rows, packages]);

  const visibleLevels = levelFilter === "all" ? levels : levels.filter((l) => l.level === levelFilter);

  const root: GenealogyMember | undefined = profile
    ? {
        id: profile.id,
        member_code: profile.member_code,
        first_name: profile.first_name,
        last_name: profile.last_name,
        full_name: profile.full_name,
        account_status: profile.account_status,
        activation_date: profile.activation_date,
        profile_photo_url: profile.profile_photo_url,
        package_name: null,
      }
    : undefined;

  const selectedStatus = selected ? accountStatus(selected.account_status) : null;

  return (
    <>
      <PageHeader
        title="Genealogy"
        description="Your sponsor tree from Level 1 to Level 5, traced from the Sponsor IDs stored in the database."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={levelFilter === "all" ? "default" : "outline"}
          onClick={() => setLevelFilter("all")}
        >
          All levels
        </Button>
        {UNILEVEL_LEVELS.map((level) => (
          <Button
            key={level}
            size="sm"
            variant={levelFilter === level ? "default" : "outline"}
            onClick={() => setLevelFilter(level)}
          >
            Level {level}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="kmd-panel space-y-4 p-6">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-20 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="kmd-panel">
          <EmptyState
            icon={ListTree}
            title="Your genealogy is empty"
            description="Share your referral link — every member who registers through it is placed under you as Level 1."
          />
        </div>
      ) : (
        <div className="kmd-panel p-5">
          <GenealogyTree root={root} levels={visibleLevels} onSelect={setSelected} />
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.full_name ?? "Member"}</DialogTitle>
            <DialogDescription>Genealogy placement and account state</DialogDescription>
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
                {selectedStatus ? (
                  <StatusBadge label={selectedStatus.label} tone={selectedStatus.tone} />
                ) : null}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Package</span>
                <span>{selected.package_name ?? "No package"}</span>
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

      {packages.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Package labels: {packages.map((pkg) => `${pkg.name} (${packageTier(pkg.tier).label})`).join(", ")}
        </p>
      ) : null}
    </>
  );
}
