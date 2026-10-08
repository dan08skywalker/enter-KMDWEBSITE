import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Network, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { EmptyState } from "@/components/kmd/empty-state";
import { MemberCell } from "@/components/kmd/member-cell";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/kmd/format";
import { accountStatus, packageTier } from "@/lib/kmd/labels";
import { UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { AccountStatus } from "@/lib/kmd/types";

interface TeamMember {
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    member_code: string;
    account_status: AccountStatus;
    profile_photo_url: string | null;
  };
  packageName: string | null;
  tier: string | null;
  level: number;
  activationDate: string | null;
}

export default function MemberTeam() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downline, setDownline] = useState<TeamMember[]>([]);
  const [upline, setUpline] = useState<TeamMember[]>([]);

  const load = async () => {
    if (!user) return;
    setLoading(true);

    const [downlineRows, uplineRows] = await Promise.all([
      supabase
        .from("sponsor_relationships")
        .select("level, ancestor_id, descendant_id, profiles:descendant_id(id, first_name, last_name, member_code, account_status, profile_photo_url, activation_date, package_id)")
        .eq("ancestor_id", user.id)
        .order("level", { ascending: true }),
      supabase
        .from("sponsor_relationships")
        .select("level, ancestor_id, profiles:ancestor_id(id, first_name, last_name, member_code, account_status, profile_photo_url, activation_date, package_id)")
        .eq("descendant_id", user.id)
        // Visibility rule: the direct sponsor is shown, and nothing above them.
        .eq("level", 1)
        .limit(1),
    ]);

    if (downlineRows.error) console.error("Could not load the team:", downlineRows.error.message);
    if (uplineRows.error) console.error("Could not load the sponsor chain:", uplineRows.error.message);

    const mapRow = (
      row: { level: number; profiles: unknown },
    ): TeamMember | null => {
      const raw = row.profiles as
        | {
            id: string;
            first_name: string;
            last_name: string;
            member_code: string;
            account_status: AccountStatus;
            profile_photo_url: string | null;
            activation_date: string | null;
            package_id: string | null;
          }
        | null;
      if (!raw) return null;
      return {
        profile: {
          id: raw.id,
          first_name: raw.first_name,
          last_name: raw.last_name,
          member_code: raw.member_code,
          account_status: raw.account_status,
          profile_photo_url: raw.profile_photo_url,
        },
        packageName: null,
        tier: null,
        level: row.level,
        activationDate: raw.activation_date,
      };
    };

    const builtDownline = ((downlineRows.data ?? []) as unknown as Array<{ level: number; profiles: unknown }>)
      .map(mapRow)
      .filter((entry): entry is TeamMember => entry !== null);
    const builtUpline = ((uplineRows.data ?? []) as unknown as Array<{ level: number; profiles: unknown }>)
      .map(mapRow)
      .filter((entry): entry is TeamMember => entry !== null);

    // Attach package names for display (membership packages are readable by any member).
    const packageIds = Array.from(
      new Set(
        [
          ...((downlineRows.data ?? []) as unknown as Array<{ profiles: { package_id?: string | null } | null }>),
          ...((uplineRows.data ?? []) as unknown as Array<{ profiles: { package_id?: string | null } | null }>),
        ]
          .map((row) => row.profiles?.package_id ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (packageIds.length > 0) {
      const { data: packages } = await supabase
        .from("membership_packages")
        .select("id, name, tier")
        .in("id", packageIds);

      const lookup = new Map(
        ((packages ?? []) as unknown as Array<{ id: string; name: string; tier: string }>).map((pkg) => [
          pkg.id,
          pkg,
        ]),
      );

      const attach = (rows: Array<{ level: number; profiles: unknown }>, target: TeamMember[]) => {
        rows.forEach((row, index) => {
          const raw = row.profiles as { package_id?: string | null } | null;
          const pkg = raw?.package_id ? lookup.get(raw.package_id) : undefined;
          if (pkg && target[index]) {
            target[index].packageName = pkg.name;
            target[index].tier = pkg.tier;
          }
        });
      };

      attach((downlineRows.data ?? []) as unknown as Array<{ level: number; profiles: unknown }>, builtDownline);
      attach((uplineRows.data ?? []) as unknown as Array<{ level: number; profiles: unknown }>, builtUpline);
    }

    setDownline(builtDownline);
    setUpline(builtUpline);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useRealtimeRefresh(["profiles", "sponsor_relationships"], () => void load());

  const byLevel = useMemo(() => {
    return UNILEVEL_LEVELS.map((level) => ({
      level,
      members: downline.filter((member) => member.level === level),
    }));
  }, [downline]);

  const totalTeam = downline.length;
  const activeTeam = downline.filter((member) => member.profile.account_status === "active").length;

  return (
    <>
      <PageHeader
        title="My Team"
        description="Your five-level sponsor network, built from the real Sponsor IDs recorded at registration."
        actions={
          <Button asChild variant="outline">
            <Link to="/app/genealogy">
              <Network className="h-4 w-4" />
              Genealogy view
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Team" value={String(totalTeam)} hint="Levels 1 to 5" icon={Users} accent="primary" loading={loading} />
        <StatCard label="Active Members" value={String(activeTeam)} hint="Qualified for rewards" accent="success" loading={loading} />
        <StatCard label="My Sponsor" value={profile?.sponsor_code ?? "None"} hint="Direct sponsor on record" icon={UserRound} accent="gold" loading={false} />
      </div>

      <section className="kmd-panel">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold">My direct sponsor</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your immediate sponsor, directly above you. Higher uplines are not shown.
          </p>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        ) : upline.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No sponsor on record"
            description="This account was registered without a sponsor, so no upline earns from its purchases."
          />
        ) : (
          <ul className="divide-y">
            {upline.map((member) => (
              <li key={member.profile.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3">
                  <StatusBadge label={`Level ${member.level}`} tone="gold" />
                  <MemberCell profile={member.profile} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {member.packageName ? (
                    <span>{member.packageName}</span>
                  ) : (
                    <span>No package</span>
                  )}
                  <span>Activated {formatDate(member.activationDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">My downline by level</h2>
        {byLevel.map((group) => (
          <div key={group.level} className="kmd-panel">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <StatusBadge label={`Level ${group.level}`} tone="info" />
                <span className="text-xs text-muted-foreground">
                  {group.members.length} {group.members.length === 1 ? "member" : "members"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {group.members.filter((member) => member.profile.account_status === "active").length} active
              </span>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
              </div>
            ) : group.members.length === 0 ? (
              <EmptyState
                icon={Users}
                title={`No members at Level ${group.level}`}
                description="Members appear here automatically when someone registers beneath your network."
              />
            ) : (
              <ul className="divide-y">
                {group.members.map((member) => {
                  const status = accountStatus(member.profile.account_status);
                  return (
                    <li key={member.profile.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <MemberCell profile={member.profile} />
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {member.tier ? (
                          <StatusBadge
                            label={packageTier(member.tier).label}
                            tone={packageTier(member.tier).tone}
                          />
                        ) : (
                          <span>No package</span>
                        )}
                        <StatusBadge label={status.label} tone={status.tone} />
                        <span>Activated {formatDate(member.activationDate)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>
    </>
  );
}
