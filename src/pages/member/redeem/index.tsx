import { useEffect, useMemo, useState } from "react";
import { Banknote, Gift, Smartphone, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { usePointRate } from "@/hooks/use-point-rate";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { redemptionStatus, redemptionType } from "@/lib/kmd/labels";
import { BANKS, OTHER_BANK, QUICK_POINT_AMOUNTS } from "@/lib/kmd/constants";
import type { Redemption } from "@/lib/kmd/types";

interface RedemptionResult {
  ok?: boolean;
  redemption?: {
    status: string;
    redemptionNumber?: string;
    points?: number;
    pesoValue?: number;
    reasonText?: string;
  };
}

export default function MemberRedeem() {
  const { user } = useAuth();
  const rate = usePointRate();
  const ledger = useMemberLedger();

  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [otherBankName, setOtherBankName] = useState("");
  const [requests, setRequests] = useState<Redemption[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const requested = toNumber(points);
  const exceeds = requested > ledger.availablePoints;

  const loadRequests = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("redemptions")
      .select("*")
      .order("requested_at", { ascending: false });
    if (error) {
      console.error("Could not load redemption requests:", error.message);
      setLoadingRequests(false);
      return;
    }
    setRequests((data ?? []) as unknown as Redemption[]);
    setLoadingRequests(false);
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submitPayout = async (redemptionType: "PAYOUT_GCASH" | "PAYOUT_BANK") => {
    if (requested <= 0) {
      toast.error("Enter the number of points to redeem");
      return;
    }
    if (exceeds) {
      toast.error("REJECTED - INSUFFICIENT AVAILABLE POINTS", {
        description: `Your available balance is ${formatPoints(ledger.availablePoints)} points.`,
      });
      return;
    }
    if (redemptionType === "PAYOUT_GCASH" && (!gcashNumber.trim() || !gcashName.trim())) {
      toast.error("Enter the GCash number and account name");
      return;
    }
    if (redemptionType === "PAYOUT_BANK") {
      if (!bankName || !bankAccountName.trim() || !bankAccountNumber.trim()) {
        toast.error("Select a bank and enter the account name and number");
        return;
      }
      if (bankName === OTHER_BANK && !otherBankName.trim()) {
        toast.error("Specify the bank name");
        return;
      }
    }

    setBusy(true);
    const outcome = await invokeFunction<RedemptionResult>("member-actions", {
      action: "request_redemption",
      points: requested,
      redemptionType,
      gcashNumber: gcashNumber || undefined,
      gcashAccountName: gcashName || undefined,
      bankName: bankName || undefined,
      bankAccountName: bankAccountName || undefined,
      bankAccountNumber: bankAccountNumber || undefined,
      otherBankName: otherBankName || undefined,
    });
    setBusy(false);

    if (!outcome.ok) {
      toast.error("Redemption rejected", { description: outcome.error });
      return;
    }
    if (outcome.data?.redemption?.status !== "PENDING") {
      toast.error("Redemption rejected", {
        description: outcome.data?.redemption?.reasonText ?? "The request could not be accepted.",
      });
      return;
    }

    toast.success(`Redemption ${outcome.data.redemption.redemptionNumber} submitted`, {
      description: `${formatPoints(requested)} points (${formatPeso(requested, rate)}) are now held pending approval.`,
    });
    setPoints("");
    await Promise.all([ledger.reload(), loadRequests()]);
  };

  const convertToWallet = async () => {
    if (requested <= 0) {
      toast.error("Enter the number of points to convert");
      return;
    }
    if (exceeds) {
      toast.error("REJECTED - INSUFFICIENT AVAILABLE POINTS", {
        description: `Your available balance is ${formatPoints(ledger.availablePoints)} points.`,
      });
      return;
    }

    setBusy(true);
    const outcome = await invokeFunction<{ conversion?: { status: string; reasonText?: string } }>(
      "member-actions",
      { action: "convert_to_wallet", points: requested },
    );
    setBusy(false);

    if (!outcome.ok || outcome.data?.conversion?.status !== "CONVERTED") {
      toast.error("Conversion failed", {
        description: outcome.error ?? outcome.data?.conversion?.reasonText ?? "The conversion was rejected.",
      });
      return;
    }

    toast.success(`${formatPoints(requested)} points moved to your Shopping Wallet`);
    setPoints("");
    await ledger.reload();
  };

  const columns: Column<Redemption>[] = [
    { key: "date", header: "Requested", cell: (row) => formatDate(row.requested_at) },
    {
      key: "number",
      header: "Redemption Number",
      cell: (row) => <span className="font-mono text-xs">{row.redemption_number}</span>,
    },
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
      key: "method",
      header: "Payout Details",
      cell: (row) => {
        if (row.redemption_type === "PAYOUT_GCASH") {
          return (
            <span className="text-xs">
              GCash {row.gcash_number ?? "\u2014"} &middot; {row.gcash_account_name ?? "\u2014"}
            </span>
          );
        }
        if (row.redemption_type === "PAYOUT_BANK") {
          const bank = row.bank_name === OTHER_BANK && row.other_bank_name ? row.other_bank_name : row.bank_name;
          return (
            <span className="text-xs">
              {bank ?? "\u2014"} &middot; {row.bank_account_name ?? "\u2014"} &middot;{" "}
              {row.bank_account_number ?? "\u2014"}
            </span>
          );
        }
        return <span className="text-xs">Shopping Wallet</span>;
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
  ];

  const quickAmounts = useMemo(
    () => QUICK_POINT_AMOUNTS.filter((amount) => amount <= Math.max(ledger.availablePoints, 0)),
    [ledger.availablePoints],
  );

  return (
    <>
      <PageHeader
        title="Redeem Points"
        description="Redeem available points for a GCash or bank payout, or move them into your Shopping Wallet."
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-5">
          <div className="kmd-panel bg-kmd-primary p-5 text-primary-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
              Available Points
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {formatPoints(ledger.availablePoints)}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Equivalent to {formatPeso(ledger.availablePoints, rate)} at the current rate
            </p>
            {ledger.heldPoints > 0 ? (
              <p className="mt-2 text-[11px] opacity-80">
                {formatPoints(ledger.heldPoints)} points are held by pending requests.
              </p>
            ) : null}
          </div>

          <div className="kmd-panel space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="redeem-points">How many points would you like to redeem?</Label>
              <Input
                id="redeem-points"
                inputMode="decimal"
                value={points}
                onChange={(event) => setPoints(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
              />
              {points.trim() && exceeds ? (
                <p className="text-xs font-medium text-destructive">
                  REJECTED - INSUFFICIENT AVAILABLE POINTS
                </p>
              ) : null}
            </div>

            {quickAmounts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPoints(String(amount))}
                  >
                    {formatPoints(amount)}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPoints(String(ledger.availablePoints))}
                >
                  All
                </Button>
              </div>
            ) : null}

            <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Available</dt>
                <dd className="font-semibold tabular-nums">{formatPoints(ledger.availablePoints)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Requested</dt>
                <dd className="font-semibold tabular-nums">{formatPoints(requested)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Peso value</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(requested, rate)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="kmd-panel p-5">
          <Tabs defaultValue="gcash">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="gcash">
                <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                GCash
              </TabsTrigger>
              <TabsTrigger value="bank">
                <Banknote className="mr-1.5 h-3.5 w-3.5" />
                Bank
              </TabsTrigger>
              <TabsTrigger value="shop">
                <Wallet className="mr-1.5 h-3.5 w-3.5" />
                Shop
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gcash" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gcash-number">GCash Number</Label>
                <Input
                  id="gcash-number"
                  inputMode="tel"
                  value={gcashNumber}
                  onChange={(event) => setGcashNumber(event.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcash-name">Account Name</Label>
                <Input
                  id="gcash-name"
                  value={gcashName}
                  onChange={(event) => setGcashName(event.target.value)}
                  placeholder="Full name on the GCash account"
                />
              </div>
              <Button
                className="w-full"
                disabled={busy || exceeds || requested <= 0}
                onClick={() => void submitPayout("PAYOUT_GCASH")}
              >
                <Gift className="h-4 w-4" />
                Redeem for GCash payout
              </Button>
            </TabsContent>

            <TabsContent value="bank" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank</Label>
                <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger id="bank-name">
                    <SelectValue placeholder="Select a bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {BANKS.map((bank) => (
                      <SelectItem key={bank} value={bank}>
                        {bank}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {bankName === OTHER_BANK ? (
                <div className="space-y-2">
                  <Label htmlFor="other-bank">Specify Bank Name</Label>
                  <Input
                    id="other-bank"
                    value={otherBankName}
                    onChange={(event) => setOtherBankName(event.target.value)}
                    placeholder="Name of your bank"
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="bank-account-name">Account Name</Label>
                <Input
                  id="bank-account-name"
                  value={bankAccountName}
                  onChange={(event) => setBankAccountName(event.target.value)}
                  placeholder="Account holder name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-account-number">Account Number</Label>
                <Input
                  id="bank-account-number"
                  inputMode="numeric"
                  value={bankAccountNumber}
                  onChange={(event) => setBankAccountNumber(event.target.value)}
                  placeholder="Account number"
                />
              </div>
              <Button
                className="w-full"
                disabled={busy || exceeds || requested <= 0}
                onClick={() => void submitPayout("PAYOUT_BANK")}
              >
                <Gift className="h-4 w-4" />
                Redeem for bank transfer
              </Button>
            </TabsContent>

            <TabsContent value="shop" className="mt-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Move points into your Shopping Wallet instead of taking a payout. The conversion
                writes a point debit and a matching wallet credit, so both balances stay in step with
                the ledger.
              </p>
              <Button
                className="w-full"
                disabled={busy || exceeds || requested <= 0}
                onClick={() => void convertToWallet()}
              >
                <Wallet className="h-4 w-4" />
                Use points to shop now
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">My redemption requests</h2>
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(row) => row.id}
          loading={loadingRequests}
          empty={
            <EmptyState
              icon={Gift}
              title="No redemption requests"
              description="Requests you submit appear here with their approval status."
            />
          }
        />
      </section>
    </>
  );
}
