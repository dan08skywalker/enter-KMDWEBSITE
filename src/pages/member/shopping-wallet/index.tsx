import { useState } from "react";
import { ArrowRightLeft, ShoppingBag, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useMemberLedger } from "@/hooks/use-member-ledger";
import { usePointRate } from "@/hooks/use-point-rate";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Points } from "@/components/kmd/amount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatPeso, formatPoints, toNumber } from "@/lib/kmd/format";
import { ledgerStatus } from "@/lib/kmd/labels";
import type { WalletLedgerRow } from "@/lib/kmd/types";

interface ConversionResult {
  ok?: boolean;
  conversion?: { status: string; points: number; walletBalance: number; availablePoints: number; reasonText?: string };
}

export default function MemberShoppingWallet() {
  const rate = usePointRate();
  const ledger = useMemberLedger();
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);

  const requested = toNumber(points);
  const invalid =
    points.trim().length > 0 && (requested <= 0 || requested > ledger.availablePoints);

  const convert = async () => {
    if (requested <= 0) {
      toast.error("Enter the number of points to convert");
      return;
    }
    if (requested > ledger.availablePoints) {
      toast.error("REJECTED - INSUFFICIENT AVAILABLE POINTS", {
        description: `You can convert up to ${formatPoints(ledger.availablePoints)} points.`,
      });
      return;
    }

    setBusy(true);
    const outcome = await invokeFunction<ConversionResult>("member-actions", {
      action: "convert_to_wallet",
      points: requested,
    });
    setBusy(false);

    if (!outcome.ok || outcome.data?.conversion?.status !== "CONVERTED") {
      const reason = outcome.error ?? outcome.data?.conversion?.reasonText ?? "The conversion was rejected.";
      toast.error("Conversion failed", { description: reason });
      return;
    }

    toast.success(`${formatPoints(requested)} points moved to your Shopping Wallet`, {
      description: "A point debit and a wallet credit were both written to the ledger.",
    });
    setPoints("");
    await ledger.reload();
  };

  const columns: Column<WalletLedgerRow>[] = [
    { key: "date", header: "Date", cell: (row) => formatDateTime(row.created_at) },
    {
      key: "txn",
      header: "Transaction ID",
      cell: (row) => <span className="font-mono text-xs">{row.transaction_id}</span>,
    },
    {
      key: "direction",
      header: "Direction",
      cell: (row) => (
        <StatusBadge label={row.direction === "CREDIT" ? "Credit" : "Debit"} tone={row.direction === "CREDIT" ? "success" : "warning"} />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => <Points value={row.amount} direction={row.direction} showSign />,
      className: "text-right",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const descriptor = ledgerStatus(row.status);
        return <StatusBadge label={descriptor.label} tone={descriptor.tone} />;
      },
    },
    { key: "note", header: "Note", cell: (row) => row.note ?? "\u2014" },
  ];

  return (
    <>
      <PageHeader
        title="Shopping Wallet"
        description="Convert eligible Unilevel Points into Shopping Wallet balance you can spend on products."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Shopping Wallet Balance"
          value={formatPoints(ledger.shoppingWallet)}
          hint={formatPeso(ledger.shoppingWallet, rate)}
          icon={ShoppingBag}
          accent="platinum"
          loading={ledger.loading}
        />
        <StatCard
          label="Available Unilevel Points"
          value={formatPoints(ledger.availablePoints)}
          hint="Eligible for conversion"
          icon={Wallet}
          accent="gold"
          loading={ledger.loading}
        />
        <StatCard
          label="Conversion Rate"
          value={`1 = ${formatPeso(1, rate)}`}
          hint="Set by the administrator in Settings"
          accent="primary"
          loading={false}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="kmd-panel p-5">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Use points to shop now</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The conversion writes a point debit and a matching wallet credit in the same
            transaction, so your balances always agree with the ledger.
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wallet-points">Points to convert</Label>
              <Input
                id="wallet-points"
                inputMode="decimal"
                value={points}
                onChange={(event) => setPoints(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
              />
              {invalid ? (
                <p className="text-xs font-medium text-destructive">
                  {requested > ledger.availablePoints
                    ? "REJECTED - INSUFFICIENT AVAILABLE POINTS"
                    : "Enter an amount greater than zero."}
                </p>
              ) : null}
            </div>

            <dl className="space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Available points</dt>
                <dd className="font-semibold tabular-nums">{formatPoints(ledger.availablePoints)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Requested points</dt>
                <dd className="font-semibold tabular-nums">{formatPoints(requested)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Wallet credit</dt>
                <dd className="font-semibold tabular-nums">{formatPeso(requested, rate)}</dd>
              </div>
            </dl>

            <Button
              onClick={() => void convert()}
              disabled={busy || invalid || requested <= 0}
              className="w-full"
            >
              Convert to Shopping Wallet
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Wallet ledger</h2>
          <DataTable
            columns={columns}
            rows={ledger.walletRows}
            rowKey={(row) => row.id}
            loading={ledger.loading}
            empty={
              <EmptyState
                icon={ShoppingBag}
                title="Your wallet is empty"
                description="Convert some points and the wallet credit will appear here immediately."
              />
            }
          />
        </div>
      </div>
    </>
  );
}
