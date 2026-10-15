import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal, RefreshCw, Search, Trash2, UserRoundCog, UserRoundX, UserRoundCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { ExportButton } from "@/components/kmd/export-button";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { MemberCell } from "@/components/kmd/member-cell";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { MemberDetailsDialog } from "./member-details-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { accountStatus, packageTier } from "@/lib/kmd/labels";
import type { MembershipPackage, Profile } from "@/lib/kmd/types";

type ActionKind =
  | "activate"
  | "account_type"
  | "role"
  | "sponsor"
  | "adjust"
  | "reconcile"
  | "status"
  | "delete";

interface ActiveAction {
  kind: ActionKind;
  member: Profile;
}

interface ReconcileResult {
  memberCode: string;
  consistent: boolean;
  displayed: Record<string, number>;
  ledger: Record<string, number>;
  discrepancies: Array<{ field: string; displayed: number; ledger: number }>;
}

export default function AdminMembers() {
  const { isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Profile[]>([]);
  const [packages, setPackages] = useState<MembershipPackage[]>([]);
  const [packageNames, setPackageNames] = useState<Record<string, string>>({});
  /** package code -> Level 1 cap, and the code for each package id. */
  const [level1Caps, setLevel1Caps] = useState<Record<string, number>>({});
  const [packageCodes, setPackageCodes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [includeTest, setIncludeTest] = useState(false);

  const [action, setAction] = useState<ActiveAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [packageId, setPackageId] = useState("");
  const [accountType, setAccountType] = useState("member");
  const [role, setRole] = useState("admin");
  const [sponsorQuery, setSponsorQuery] = useState("");
  const [sponsorResults, setSponsorResults] = useState<Profile[]>([]);
  const [sponsorId, setSponsorId] = useState("");
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustKey, setAdjustKey] = useState<string | null>(null);
  const [direction, setDirection] = useState("CREDIT");
  const [reconcile, setReconcile] = useState<ReconcileResult | null>(null);
  const [memberStatus, setMemberStatus] = useState("inactive");
  const [confirmCode, setConfirmCode] = useState("");
  const [detailsMember, setDetailsMember] = useState<Profile | null>(null);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("profiles").select("*").order("registration_date", { ascending: false });
    if (!includeTest) query = query.eq("is_test", false);

    const [memberResult, packageResult] = await Promise.all([
      query,
      supabase.from("membership_packages").select("*").eq("is_active", true),
    ]);

    if (memberResult.error) console.error("Could not load members:", memberResult.error.message);
    if (packageResult.error) console.error("Could not load packages:", packageResult.error.message);

    setMembers((memberResult.data ?? []) as unknown as Profile[]);
    const packageRows = (packageResult.data ?? []) as unknown as MembershipPackage[];
    setPackages(packageRows);
    setPackageNames(Object.fromEntries(packageRows.map((pkg) => [pkg.id, pkg.name])));
    setPackageCodes(Object.fromEntries(packageRows.map((pkg) => [pkg.id, pkg.package_code])));

    // The Level 1 cap that applies to a member follows the package they hold.
    const { data: capRows, error: capError } = await supabase
      .from("level1_caps")
      .select("package_code, cap_amount");
    if (capError) console.error("Could not load the Level 1 caps:", capError.message);
    setLevel1Caps(
      Object.fromEntries(
        ((capRows ?? []) as Array<{ package_code: string; cap_amount: number }>).map((row) => [
          row.package_code,
          row.cap_amount,
        ]),
      ),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["profiles"], () => void load());

  const searchSponsors = async (term: string) => {
    setSponsorQuery(term);
    if (term.trim().length < 2) {
      setSponsorResults([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, member_code, username")
      .or(`member_code.ilike.%${term.trim()}%,username.ilike.%${term.trim()}%`)
      .limit(8);
    if (error) {
      console.error("Sponsor search failed:", error.message);
      return;
    }
    setSponsorResults((data ?? []) as unknown as Profile[]);
  };

  const openAction = (kind: ActionKind, member: Profile, presetStatus?: string) => {
    setAction({ kind, member });
    setReason("");
    setPackageId(member.package_id ?? "");
    setAccountType(member.account_type);
    setRole("admin");
    setSponsorQuery("");
    setSponsorResults([]);
    setSponsorId(member.direct_sponsor_id ?? "");
    setAdjustPoints("");
    // One key per opened dialog, so a resend is recognised instead of posted twice.
    setAdjustKey(crypto.randomUUID());
    setDirection("CREDIT");
    setReconcile(null);
    setMemberStatus(presetStatus ?? (member.account_status === "active" ? "suspended" : "active"));
    setConfirmCode("");
  };

  const closeAction = () => {
    setAction(null);
    setReconcile(null);
  };

  type ActionResult = { status?: string; reasonText?: string; reason?: string };

  const run = async (body: Record<string, unknown>, successMessage: string) => {
    if (!action) return;
    setBusy(true);
    const outcome = await invokeFunction<{ ok?: boolean; result?: ActionResult }>(
      "admin-actions",
      body,
    );
    setBusy(false);

    if (!outcome.ok) {
      toast.error(successMessage + " failed", { description: outcome.error });
      return;
    }

    // The backend also reports refusals inside a successful HTTP response, for
    // example a sponsor move that would create a cycle. Surface that reason
    // instead of claiming the action worked.
    const result = outcome.data?.result;
    if (result?.status === "FAILED" || result?.status === "REJECTED") {
      toast.error(successMessage + " was refused", {
        description: result.reasonText ?? result.reason ?? "The request was not accepted.",
      });
      await load();
      return;
    }

    toast.success(successMessage);
    closeAction();
    await load();
  };

  const confirmAction = async () => {
    if (!action) return;
    const member = action.member;

    switch (action.kind) {
      case "activate":
        if (!reason.trim()) {
          toast.error("A reason is required for this action");
          return;
        }
        return run(
          { action: "activate_member", memberId: member.id, packageId: packageId || null, reason },
          `${member.member_code} activated`,
        );
      case "account_type":
        return run(
          { action: "set_account_type", memberId: member.id, accountType },
          `Account type set to ${accountType}`,
        );
      case "role":
        return run({ action: "set_role", memberId: member.id, role }, `Role ${role} granted`);
      case "sponsor":
        if (!reason.trim()) {
          toast.error("A reason is required for a sponsor change");
          return;
        }
        if (!sponsorId) {
          toast.error("Select the new sponsor");
          return;
        }
        return run(
          { action: "change_sponsor", memberId: member.id, sponsorId, reason },
          "Sponsor changed and genealogy rebuilt",
        );
      case "adjust":
        if (!reason.trim()) {
          toast.error("A reason is required for an adjustment");
          return;
        }
        if (!adjustPoints || Number(adjustPoints) <= 0) {
          toast.error("Enter an adjustment amount greater than zero");
          return;
        }
        return run(
          {
            action: "adjust_points",
            memberId: member.id,
            points: Number(adjustPoints),
            direction,
            reason,
            idempotencyKey: adjustKey,
          },
          "Adjustment posted",
        );
      case "reconcile": {
        setBusy(true);
        const outcome = await invokeFunction<{ ok?: boolean; result?: ReconcileResult }>("admin-actions", {
          action: "reconcile_balance",
          memberId: member.id,
        });
        setBusy(false);
        if (!outcome.ok || !outcome.data?.result) {
          toast.error("Could not reconcile the balance", { description: outcome.error });
          return;
        }
        setReconcile(outcome.data.result);
        return;
      }
      case "status":
        if (!reason.trim()) {
          toast.error("A reason is required for a status change");
          return;
        }
        return run(
          { action: "set_member_status", memberId: member.id, status: memberStatus, reason },
          memberStatus === "active"
            ? `${member.member_code} reactivated`
            : `${member.member_code} set to ${memberStatus}`,
        );
      case "delete":
        if (!reason.trim()) {
          toast.error("A reason is required for deleting a member");
          return;
        }
        if (confirmCode.trim().toUpperCase() !== member.member_code.toUpperCase()) {
          toast.error("Type the member code exactly to confirm", {
            description: `Expected ${member.member_code}`,
          });
          return;
        }
        return run(
          { action: "delete_member", memberId: member.id, confirmCode: confirmCode.trim(), reason },
          `${member.member_code} deleted`,
        );
      default:
        return;
    }
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter((member) => {
      if (status !== "all" && member.account_status !== status) return false;
      if (needle) {
        const haystack = `${member.member_code} ${member.username} ${member.email} ${member.first_name} ${member.last_name}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [members, search, status]);

  const columns: Column<Profile>[] = [
    { key: "member", header: "Member", cell: (row) => <MemberCell profile={row} /> },
    {
      key: "package",
      header: "Package",
      cell: (row) => {
        const name = row.package_id ? packageNames[row.package_id] : null;
        if (!name) return <span className="text-xs text-muted-foreground">None</span>;
        return <StatusBadge label={packageTier(name.toLowerCase().includes("gold") ? "gold" : name.toLowerCase().includes("platinum") ? "platinum" : name.toLowerCase().includes("classic") ? "classic" : "trial").label} tone={packageTier(name.toLowerCase().includes("gold") ? "gold" : name.toLowerCase().includes("platinum") ? "platinum" : name.toLowerCase().includes("classic") ? "classic" : "trial").tone} />;
      },
    },
    {
      key: "level1Cap",
      header: "Level 1 cap",
      className: "text-right",
      cell: (row) => {
        const code = row.package_id ? packageCodes[row.package_id] : null;
        const cap = code ? level1Caps[code] : undefined;
        if (cap === undefined) {
          return <span className="text-[11px] text-muted-foreground">Matrix</span>;
        }
        return (
          <span className="text-[11px] font-semibold tabular-nums" title="Per qualifying purchase">
            {formatPeso(cap)}
          </span>
        );
      },
    },
    { key: "type", header: "Type", cell: (row) => <span className="text-xs uppercase">{row.account_type}</span> },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = accountStatus(row.account_status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "sponsor", header: "Sponsor", cell: (row) => <span className="font-mono text-xs">{row.sponsor_code ?? "\u2014"}</span> },
    { key: "points", header: "Unilevel Points", cell: (row) => <span className="tabular-nums">{formatPoints(row.unilevel_points_balance)}</span>, className: "text-right" },
    { key: "loyalty", header: "Loyalty", cell: (row) => <span className="tabular-nums">{formatPoints(row.loyalty_credits_balance)}</span>, className: "text-right" },
    { key: "registered", header: "Registered", cell: (row) => formatDate(row.registration_date) },
    { key: "activated", header: "Activated", cell: (row) => formatDate(row.activation_date) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Member actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[230px]">
            <DropdownMenuLabel className="font-mono text-[11px]">{row.member_code}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openAction("activate", row)}>Activate membership</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction("account_type", row)}>Set account type</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction("role", row)}>Grant role</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction("sponsor", row)}>Change sponsor</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDetailsMember(row)}>
              <UserRoundCog className="h-3.5 w-3.5" />
              Edit member details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openAction("adjust", row)}>Adjust points</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction("reconcile", row)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reconcile balance
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.account_status !== "suspended" ? (
              <DropdownMenuItem
                onSelect={() => openAction("status", row, "suspended")}
                className="text-[hsl(var(--warning))] focus:text-[hsl(var(--warning))]"
              >
                <UserRoundX className="h-3.5 w-3.5" />
                Suspend member
              </DropdownMenuItem>
            ) : null}
            {row.account_status === "suspended" || row.account_status === "inactive" ? (
              <DropdownMenuItem onSelect={() => openAction("status", row, "active")}>
                <UserRoundCheck className="h-3.5 w-3.5" />
                Reactivate member
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => openAction("delete", row)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete member
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const actionTitle: Record<ActionKind, string> = {
    activate: "Activate membership",
    account_type: "Set account type",
    role: "Grant role",
    sponsor: "Change sponsor",
    adjust: "Adjust points",
    reconcile: "Reconcile balance",
    status: "Change membership status",
    delete: "Delete member",
  };

  // The suspension dialog is titled by what the administrator is actually doing,
  // not by the shared "status" kind behind it.
  const dialogTitle = action
    ? action.kind === "status"
      ? memberStatus === "suspended"
        ? "Suspend member"
        : memberStatus === "active"
          ? "Reactivate member"
          : "Mark member inactive"
      : actionTitle[action.kind]
    : "";

  return (
    <>
      <PageHeader
        title="Members"
        description="The member register. Membership state, sponsor placement and balances are administered here and every change is audited."
        actions={
          <>
            <ExportButton
              dataset="members"
              filters={{
                search: search || null,
                status: status === "all" ? null : status,
                includeTest,
              }}
            />
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </>
        }
      />

      <FilterBar className="flex-wrap">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, member ID, username or email"
        />
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "pending", label: "Pending Activation" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Switch id="members-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
          <Label htmlFor="members-include-test" className="cursor-pointer text-xs">
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
            icon={Users}
            title="No members found"
            description="Adjust the filters, or turn on test data to see the seeded test roster."
          />
        }
      />

      <Dialog open={action !== null} onOpenChange={(open) => !open && closeAction()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {action ? `${action.member.full_name} (${action.member.member_code})` : ""}
            </DialogDescription>
          </DialogHeader>

          {action?.kind === "activate" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activate-package">Membership package</Label>
                <Select value={packageId} onValueChange={setPackageId}>
                  <SelectTrigger id="activate-package">
                    <SelectValue placeholder="Select a package (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name} ({packageTier(pkg.tier).label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="activate-reason">Reason (recorded on the audit log)</Label>
                <Textarea
                  id="activate-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          {action?.kind === "account_type" ? (
            <div className="space-y-2">
              <Label htmlFor="account-type">Account type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {action?.kind === "role" ? (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="retailer">Retailer</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                  {isSuperAdmin ? <SelectItem value="super_admin">Super Administrator</SelectItem> : null}
                </SelectContent>
              </Select>
              {!isSuperAdmin ? (
                <p className="text-xs text-muted-foreground">
                  Only a super administrator can grant the super administrator role.
                </p>
              ) : null}
            </div>
          ) : null}

          {action?.kind === "sponsor" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sponsor-search">New sponsor</Label>
                <Input
                  id="sponsor-search"
                  value={sponsorQuery}
                  onChange={(event) => void searchSponsors(event.target.value)}
                  placeholder="Search by member ID or username"
                />
                {sponsorResults.length > 0 ? (
                  <ul className="max-h-40 overflow-y-auto rounded-lg border kmd-scroll">
                    {sponsorResults.map((candidate) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          onClick={() => setSponsorId(candidate.id)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted ${
                            sponsorId === candidate.id ? "bg-muted" : ""
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
                <p className="text-[11px] text-muted-foreground">
                  Selected sponsor: {sponsorId ? sponsorId.slice(0, 8) : "none"}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sponsor-reason">Reason</Label>
                <Textarea
                  id="sponsor-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          {action?.kind === "adjust" ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adjust-direction">Direction</Label>
                  <Select value={direction} onValueChange={setDirection}>
                    <SelectTrigger id="adjust-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">Credit points</SelectItem>
                      <SelectItem value="DEBIT">Debit points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adjust-points">Points</Label>
                  <Input
                    id="adjust-points"
                    inputMode="decimal"
                    value={adjustPoints}
                    onChange={(event) => setAdjustPoints(event.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-reason">Reason</Label>
                <Textarea
                  id="adjust-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  placeholder="Recorded on the audit log and on the ledger entry"
                />
              </div>
              <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Unilevel points</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatPoints(action?.member.unilevel_points_balance)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground">Resulting balance</dt>
                  <dd className="font-bold tabular-nums">
                    {formatPoints(
                      direction === "CREDIT"
                        ? toNumber(action?.member.unilevel_points_balance) + Number(adjustPoints || 0)
                        : toNumber(action?.member.unilevel_points_balance) - Number(adjustPoints || 0),
                    )}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                An adjustment is written as a new ADMIN_ADJUSTMENT ledger entry that records the
                previous and resulting balance. Existing history is never edited, and a deduction can
                never exceed the member's available points.
              </p>
            </div>
          ) : null}

          {action?.kind === "status" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member-status">New status</Label>
                <Select value={memberStatus} onValueChange={setMemberStatus}>
                  <SelectTrigger id="member-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status-reason">Reason (recorded on the audit log)</Label>
                <Textarea
                  id="status-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                />
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold">What this status does</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>
                    Suspended and inactive accounts cannot place orders, request payouts or convert
                    points, and they stop accruing bonuses as an upline.
                  </li>
                  <li>
                    Use Suspended for policy violations and inactivity. The reason you record here is
                    kept on the audit log against this member.
                  </li>
                  <li>
                    Nothing is deleted and the change is reversible: reactivating restores ordering,
                    payouts and earning immediately.
                  </li>
                </ul>
              </div>
            </div>
          ) : null}

          {action?.kind === "delete" ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive">
                  This permanently removes the member record.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deletion is refused whenever records that must be kept are involved. It will not proceed
                  if the member has orders, ledger entries, redemptions, wallet activity or payment proofs,
                  because financial history is never destroyed. It is also refused when the member sponsors
                  a downline, holds an administrator role, or has authored content. In those cases
                  deactivate the account instead.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono">{action.member.member_code}</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirmCode}
                  onChange={(event) => setConfirmCode(event.target.value)}
                  placeholder="KMD-0000-0000-0000-0000"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-reason">Reason (recorded on the audit log)</Label>
                <Textarea
                  id="delete-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                />
              </div>
            </div>
          ) : null}

          {action?.kind === "reconcile" ? (
            <div className="space-y-3">
              {busy && !reconcile ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Comparing the displayed balance with the ledger
                </p>
              ) : null}
              {reconcile ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Result</span>
                    <StatusBadge
                      label={reconcile.consistent ? "Consistent" : "Discrepancy found"}
                      tone={reconcile.consistent ? "success" : "danger"}
                    />
                  </div>
                  <Separator />
                  {(["unilevelPoints", "loyaltyCredits", "shoppingWallet"] as const).map((key) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="tabular-nums">
                        displayed {formatPoints(reconcile.displayed?.[key])} &middot; ledger{" "}
                        {formatPoints(reconcile.ledger?.[key])}
                      </span>
                    </div>
                  ))}
                  {reconcile.discrepancies?.length > 0 ? (
                    <ul className="space-y-1 text-xs text-destructive">
                      {reconcile.discrepancies.map((item) => (
                        <li key={item.field}>
                          {item.field}: displayed {formatPoints(item.displayed)} but ledger says{" "}
                          {formatPoints(item.ledger)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={busy}>
              {action?.kind === "reconcile" ? "Close" : "Cancel"}
            </Button>
            {action?.kind === "reconcile" ? (
              <Button onClick={() => void confirmAction()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Run comparison
              </Button>
            ) : action?.kind === "delete" ? (
              <Button variant="destructive" onClick={() => void confirmAction()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete member
              </Button>
            ) : (
              <Button onClick={() => void confirmAction()} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Apply
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MemberDetailsDialog
        member={detailsMember}
        onOpenChange={(open) => {
          if (!open) setDetailsMember(null);
        }}
        onSaved={() => void load()}
      />
    </>
  );
}
