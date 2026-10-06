import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/kmd/format";
import { accountStatus } from "@/lib/kmd/labels";
import { StatusBadge } from "@/components/kmd/status-badge";
import type { Profile } from "@/lib/kmd/types";

interface MemberCellProps {
  profile: Pick<Profile, "first_name" | "last_name" | "member_code" | "account_status" | "profile_photo_url">;
  showStatus?: boolean;
  secondary?: string;
  className?: string;
}

/** Avatar + name + member code, used in every member-facing list. */
export function MemberCell({ profile, showStatus = false, secondary, className }: MemberCellProps) {
  const status = accountStatus(profile.account_status);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Avatar className="h-8 w-8 shrink-0 border">
        {profile.profile_photo_url ? (
          <AvatarImage src={profile.profile_photo_url} alt={profile.first_name} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
          {initials(profile.first_name, profile.last_name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {profile.first_name} {profile.last_name}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {secondary ?? profile.member_code}
        </p>
      </div>
      {showStatus ? <StatusBadge label={status.label} tone={status.tone} className="ml-1" /> : null}
    </div>
  );
}
