import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/kmd/status-badge";
import { accountStatus } from "@/lib/kmd/labels";
import { formatDate, initials } from "@/lib/kmd/format";
import type { AccountStatus } from "@/lib/kmd/types";

export interface GenealogyMember {
  id: string;
  member_code: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  account_status: AccountStatus;
  activation_date?: string | null;
  profile_photo_url?: string | null;
  package_name?: string | null;
}

export interface GenealogyLevel {
  level: number;
  members: GenealogyMember[];
}

export function GenealogyNode({
  member,
  onSelect,
  compact = false,
}: {
  member: GenealogyMember;
  onSelect?: (member: GenealogyMember) => void;
  compact?: boolean;
}) {
  const status = accountStatus(member.account_status);
  const name = member.full_name ?? `${member.first_name} ${member.last_name}`;

  return (
    <button
      type="button"
      onClick={onSelect ? () => onSelect(member) : undefined}
      className={cn(
        "group flex w-[190px] shrink-0 flex-col gap-2 rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
        onSelect && "hover:border-primary/40 hover:shadow-elegant",
        compact && "w-[172px] p-2.5",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 shrink-0 border">
          {member.profile_photo_url ? (
            <AvatarImage src={member.profile_photo_url} alt={name} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
            {initials(member.first_name, member.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">{name}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {member.member_code}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={status.label} tone={status.tone} />
        {member.package_name ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {member.package_name}
          </span>
        ) : null}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Activated {formatDate(member.activation_date)}
      </p>
    </button>
  );
}

interface GenealogyTreeProps {
  root?: GenealogyMember;
  levels: GenealogyLevel[];
  onSelect?: (member: GenealogyMember) => void;
  emptyLevel?: (level: number) => ReactNode;
  className?: string;
}

/**
 * Five-level genealogy view. Each level is a rail of member cards connected back
 * to the level above, so the sponsor chain is readable at a glance.
 */
export function GenealogyTree({
  root,
  levels,
  onSelect,
  emptyLevel,
  className,
}: GenealogyTreeProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {root ? (
        <div className="flex flex-col items-center">
          <GenealogyNode member={root} />
          <span className="h-6 w-px bg-border" aria-hidden />
        </div>
      ) : null}

      {levels.map((level) => (
        <div key={level.level} className="relative border-t border-dashed border-border pt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-[11px] font-bold uppercase tracking-wider text-primary">
              Level {level.level}
            </span>
            <span className="text-xs text-muted-foreground">
              {level.members.length} {level.members.length === 1 ? "member" : "members"}
            </span>
          </div>

          {level.members.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />
              {emptyLevel
                ? emptyLevel(level.level)
                : `No member at Level ${level.level} yet.`}
            </div>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 kmd-scroll">
              {level.members.map((member) => (
                <GenealogyNode key={member.id} member={member} onSelect={onSelect} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
