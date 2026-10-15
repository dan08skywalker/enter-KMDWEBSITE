import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Gift, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { invokeFunction } from "@/lib/kmd/invoke";
import { toast } from "sonner";
import { PageHeader } from "@/components/kmd/page-header";
import { ExportButton } from "@/components/kmd/export-button";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { FilterBar, SearchInput, SelectFilter } from "@/components/kmd/filter-bar";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { redemptionStatus, redemptionType } from "@/lib/kmd/labels";
import { OTHER_BANK } from "@/lib/kmd/constants";
import type { Redemption } from "@/lib/kmd/types";

interface Row extends Redemption {
  memberName: string | null;
}

export default function AdminRedemptions() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [includeTest, setIncludeTest] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase.from("redemptions").select("*").order("requested_at", { ascending: false }).limit(300);
    if (!includeTest) query = query.eq("is_test", false);

    const { data, error } = await query;
    if (error) {
      console.error("Could not load redemptions:", error.message);
      setLoading(false);
      return;
    }

    const redemptions = (data ?? []) as unknown as Redemption[];
    const memberIds = Array.from(new Set(redemptions.map((row) => row.member_id)));

    let names = new Map<string, string>();
    if (memberIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, member_code")
        .in("id", memberIds);
      if (profileError) console.error("Could not load members:", profileError.message);
      names = new Map(
        ((profiles ?? []) as Array<{ id: string; first_name: string; last_name: string; member_code: string }>).map(
          (profile) => [profile.id, `${profile.first_name} ${profile.last_name} (${profile.member_code})`],
        ),
      );
    }

    setRows(redemptions.map((row) => ({ ...row, memberName: names.get(row.member_id) ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTest]);

  useRealtimeRefresh(["redemptions"], () => void load());

  const decide = async (redemptionId: string, decision: string, reason?: string) => {
    const outcome = await invokeFunction("admin-actions", {
      action: "review_redemption",
      redemptionId,
      decision,
      reason,
    });
    if (!outcome.ok) {
      toast.error("Could not update the redemption", { description: outcome.error });
      return { error: outcome.error };
    }
    toast.success(
      decision === "approve"
        ? "Redemption approved — the held points are now a posted debit"
        : decision === "reject"
          ? "Redemption rejected — the held points were released"
          : "Redemption marked as paid",
    );
    await load();
    return {};
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && row.redemption_type !== type) return false;
      if (needle) {
        const haystack = `${row.redemption_number} ${row.member_code} ${row.memberName ?? ""} ${
          row.gcash_number ?? ""
        } ${row.bank_account_number ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, status, type, search]);

  const stats = useMemo(() => {
    const pending = rows.filter((row) => row.status === "pending");
    const approvedUnpaid = rows.filter((row) => row.status === "approved");
    return {
      pending: pending.length,
      pendingPoints: pending.reduce((sum, row) => sum + toNumber(row.points), 0),
      payable: rows
        .filter((row) => ["pending", "approved"].includes(row.status))
        .reduce((sum, row) => sum + toNumber(row.peso_value), 0),
      approvedUnpaid: approvedUnpaid.length,
    };
  }, [rows]);

  const columns: Column<Row>[] = [
    { key: "requested", header: "Requested", cell: (row) => formatDate(row.requested_at) },
    {
      key: "number",
      header: "Redemption Number",
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.redemption_number}</span>,
    },
    { key: "member", header: "Member", cell: (row) => <span className="text-xs">{row.memberName ?? row.member_code}</span> },
    {
      key: "type",
      header: "Type",
      cell: (row) => {
        const descriptor = redemptionType(row.redemption_type);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "points", header: "Points", cell: (row) => formatPoints(row.points), className: "text-right" },
    {
      key: "peso",
      header: "Peso Value",
      cell: (row) => formatPeso(row.peso_value),
      className: "text-right",
    },
    {
      key: "payout",
      header: "Payout Details",
      cell: (row) => {
        if (row.redemption_type === "PAYOUT_GCASH") {
          return (
            <span className="text-xs">
              GCash {row.gcash_number ?? "\u2014"}
              <br />
              {row.gcash_account_name ?? "\u2014"}
            </span>
          );
        }
        if (row.redemption_type === "PAYOUT_BANK") {
          const bank =
            row.bank_name === OTHER_BANK && row.other_bank_name ? row.other_bank_name : row.bank_name;
          return (
            <span className="text-xs">
              {bank ?? "\u2014"}
              <br />
              {row.bank_account_name ?? "\u2014"} &middot; {row.bank_account_number ?? "\u2014"}
            </span>
          );
        }
        return <span className="text-xs">Shopping Wallet conversion</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = redemptionStatus(row.status);
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge label={descriptor.label} tone={descriptor.tone} />
            {row.rejection_reason ? (
              <span className="text-[11px] text-destructive">{row.rejection_reason}</span>
            ) : null}
          </div>
        );
      },
    },
    { key: "reviewed", header: "Reviewed", cell: (row) => formatDate(row.reviewed_at) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-1">
          {row.status === "pending" ? (
            <>
              <ConfirmActionDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                }
                title={`Approve ${row.redemption_number}?`}
                description={`Approving converts the held ${formatPoints(row.points)} point debit into a posted debit, reducing the member's balance by that amount.`}
                confirmLabel="Approve payout"
                reasonRequired
                reasonLabel="Approval note"
                onConfirm={(reason) => decide(row.id, "approve", reason)}
              />
              <ConfirmActionDialog
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive">
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                }
                title={`Reject ${row.redemption_number}?`}
                description={`The held ${formatPoints(row.points)} points are released back to the member's available balance immediately.`}
                confirmLabel="Reject request"
                destructive
                reasonRequired
                reasonLabel="Reason for rejection"
                onConfirm={(reason) => decide(row.id, "reject", reason)}
              />
            </>
          ) : null}

          {row.status === "approved" ? (
            <ConfirmActionDialog
              trigger={
                <Button variant="ghost" size="sm">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  Mark paid
                </Button>
              }
              title={`Mark ${row.redemption_number} as paid?`}
              description="Record that the payout has been released to the member."
              confirmLabel="Mark as paid"
              reasonRequired
              reasonLabel="Payout reference or note"
              onConfirm={(reason) => decide(row.id, "paid", reason)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Redemptions"
        description="Member payout requests. A request can never exceed the member's available points, and points are held from the moment it is submitted."
        actions={
          <ExportButton
            dataset="redemptions"
            filters={{
              search: search || null,
              status: status === "all" ? null : status,
              type: type === "all" ? null : type,
              includeTest,
            }}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Requests" value={String(stats.pending)} icon={Gift} accent="gold" loading={loading} />
        <StatCard label="Points On Hold" value={formatPoints(stats.pendingPoints)} accent="primary" loading={loading} />
        <StatCard label="Value Payable" value={formatPeso(stats.payable)} accent="platinum" loading={loading} />
        <StatCard label="Approved, Not Paid" value={String(stats.approvedUnpaid)} accent="success" loading={loading} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Switch id="redemptions-include-test" checked={includeTest} onCheckedChange={setIncludeTest} />
        <Label htmlFor="redemptions-include-test" className="cursor-pointer text-xs">
          Include test data
        </Label>
      </div>

      <FilterBar className="flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search redemption number, member, GCash or account number" />
        <SelectFilter
          value={status}
          onChange={setStatus}
          allLabel="All statuses"
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "paid", label: "Paid" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
        <SelectFilter
          value={type}
          onChange={setType}
          allLabel="All types"
          options={[
            { value: "PAYOUT_GCASH", label: "GCash Payout" },
            { value: "PAYOUT_BANK", label: "Bank Transfer" },
            { value: "SHOPPING_WALLET", label: "Shopping Wallet" },
          ]}
          className="sm:w-[190px]"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={Gift}
            title="No redemption requests"
            description="Requests submitted by members appear here for approval."
          />
        }
      />
    </>
  );
}
