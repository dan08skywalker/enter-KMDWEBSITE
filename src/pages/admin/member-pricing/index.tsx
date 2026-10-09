import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { SearchInput } from "@/components/kmd/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPeso, toNumber } from "@/lib/kmd/format";
import { pricingCategoryLabel } from "@/lib/kmd/pricing-labels";

/** The categories in the order the matrix is published. */
const CATEGORIES = ["trial", "classic", "gold", "platinum", "stockist"] as const;

type PriceCell = { price: number; srp: number | null };

interface MatrixProduct {
  productId: string;
  sku: string;
  name: string;
  productType: string;
  category: string | null;
  sellingPrice: number;
  regularPrice: number | null;
  isActive: boolean;
  prices: Record<string, PriceCell>;
}

interface MatrixResponse {
  result?: { version?: string; products?: MatrixProduct[] };
}

/**
 * The member pricing matrix.
 *
 * Prices are keyed on the product id, so a rename never moves a price, and each
 * change is validated, audited with its previous value, and versioned through the
 * backend function — never written from the browser.
 */
export default function AdminMemberPricing() {
  const { isSuperAdmin, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState("1");
  const [rows, setRows] = useState<MatrixProduct[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [target, setTarget] = useState<{ product: MatrixProduct; category: string } | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const outcome = await invokeFunction<MatrixResponse>("admin-actions", {
      action: "pricing_matrix",
    });
    setLoading(false);

    if (!outcome.ok) {
      console.error("Could not load the pricing matrix:", outcome.error);
      setRows([]);
      return;
    }

    const result = outcome.data?.result;
    setVersion(result?.version ?? "1");
    setRows(result?.products ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!includeInactive && !row.isActive) return false;
      if (!needle) return true;
      return `${row.sku} ${row.name} ${row.productType}`.toLowerCase().includes(needle);
    });
  }, [rows, search, includeInactive]);

  const openEditor = (product: MatrixProduct, category: string) => {
    const current = product.prices[category]?.price;
    setError(null);
    setPriceDraft(current === undefined || current === null ? "" : String(current));
    setTarget({ product, category });
  };

  const save = async () => {
    if (!target) return;
    const parsed = toNumber(priceDraft, NaN);
    if (!Number.isFinite(parsed)) {
      setError("Enter a price.");
      return;
    }
    if (parsed < 0) {
      setError("Enter a price of zero or more.");
      return;
    }

    setSaving(true);
    setError(null);
    const outcome = await invokeFunction<{
      result?: { status?: string; price?: number; previousPrice?: number; pricingVersion?: string; reasonText?: string };
    }>("admin-actions", {
      action: "set_member_price",
      productId: target.product.productId,
      category: target.category,
      price: parsed,
    });
    setSaving(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The price could not be saved.");
      return;
    }

    const result = outcome.data?.result;
    if (result?.status !== "UPDATED") {
      setError(result?.reasonText ?? "The price was refused.");
      return;
    }

    toast.success("Member price updated", {
      description:
        `${target.product.sku} · ${pricingCategoryLabel(target.category)}: ` +
        `${result.previousPrice === null || result.previousPrice === undefined ? "not set" : formatPeso(result.previousPrice)} → ${formatPeso(result.price ?? parsed)}. ` +
        `Pricing version ${result.pricingVersion}. Existing orders and rewards are unchanged.`,
    });

    setTarget(null);
    await load();
  };

  const columns: Column<MatrixProduct>[] = [
    {
      key: "product",
      header: "Product / package",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-semibold">{row.name}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{row.sku}</span>
        </div>
      ),
    },
    {
      key: "srp",
      header: "SRP / published",
      cell: (row) => (
        <span className="tabular-nums">{formatPeso(row.sellingPrice)}</span>
      ),
      className: "text-right",
    },
    ...CATEGORIES.map((category) => ({
      key: category,
      header: pricingCategoryLabel(category) ?? category,
      className: "text-right",
      cell: (row: MatrixProduct) => {
        const cell = row.prices[category];
        return (
          <button
            type="button"
            onClick={() => openEditor(row, category)}
            className="inline-flex items-center gap-1.5 rounded px-1 tabular-nums transition-colors hover:bg-muted"
            title={`Edit the ${pricingCategoryLabel(category)} price for ${row.sku}`}
          >
            {cell ? formatPeso(cell.price) : <span className="text-muted-foreground">Not set</span>}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        );
      },
    })),
    {
      key: "status",
      header: "Product",
      cell: (row) => (
        <StatusBadge
          label={row.isActive ? "Active" : "Hidden"}
          tone={row.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Member Pricing"
        description="What each membership category pays when a member reorders products or buys a package again. The published SRP stays the fallback for everyone else."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Pricing version <span className="font-semibold text-foreground">{version}</span>. The
          category is read from the buyer's own approved membership or stockist record when an order is
          placed — never from the browser. Prices are matched on the product ID and SKU, so renaming a
          product never moves a price, and every change is written to the audit log with its previous
          value, your account and the time. Reward configuration is separate: changing a price here
          does not change any commission, past or future.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-sm">
          <SearchInput value={search} onChange={setSearch} placeholder="Search SKU, product or type" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="pricing-include-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="pricing-include-inactive" className="cursor-pointer text-xs">
            Include hidden products
          </Label>
        </div>
      </div>

      {!isAdmin && !isSuperAdmin ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          Administrator access is required to change prices. You can view them here only if the server
          grants it; every change is rejected without an administrator role.
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.productId}
        loading={loading}
        empty={
          <EmptyState
            icon={BadgePercent}
            title="No products match"
            description="Adjust the search, or include hidden products to see the rest of the matrix."
          />
        }
      />

      <Dialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (saving) return;
          if (!open) setTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set a member price</DialogTitle>
            <DialogDescription>
              {target
                ? `${target.product.name} (${target.product.sku}) · ${pricingCategoryLabel(target.category)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <dl className="space-y-2 rounded-lg border p-3 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Published price (SRP)</dt>
                <dd className="tabular-nums">
                  {target ? formatPeso(target.product.sellingPrice) : "\u2014"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Current member price</dt>
                <dd className="tabular-nums">
                  {target && target.product.prices[target.category]
                    ? formatPeso(target.product.prices[target.category].price)
                    : "Not set"}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              <Label htmlFor="member-price-amount">New member price</Label>
              <Input
                id="member-price-amount"
                inputMode="decimal"
                value={priceDraft}
                onChange={(event) => setPriceDraft(event.target.value.replace(/[^0-9.]/g, ""))}
              />
              <p className="text-[11px] text-muted-foreground">
                Applies to eligible members from their next order. Submitted orders keep the price they
                were placed at.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !target}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />}
              Save price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
