import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { ExportButton } from "@/components/kmd/export-button";
import { FilterBar, SearchInput } from "@/components/kmd/filter-bar";
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
import { invokeFunction } from "@/lib/kmd/invoke";
import { formatDateTime } from "@/lib/kmd/format";

interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  productType: string;
  isDigital: boolean;
  quantityOnHand: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  isUnlimited: boolean;
  updatedAt: string | null;
  reserved: number;
}

export default function AdminInventory() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [quantity, setQuantity] = useState("0");
  const [threshold, setThreshold] = useState("5");
  const [unlimited, setUnlimited] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, sku, name, product_type, is_digital, sort_order, inventory (quantity_on_hand, reserved_quantity, low_stock_threshold, is_unlimited, updated_at)",
      )
      .order("sort_order");

    if (error) {
      console.error("Could not load inventory:", error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mapped = (data ?? []).map((raw) => {
      const row = raw as unknown as {
        id: string;
        sku: string;
        name: string;
        product_type: string;
        is_digital: boolean;
        inventory:
          | {
              quantity_on_hand: number;
              reserved_quantity: number;
              low_stock_threshold: number;
              is_unlimited: boolean;
              updated_at: string;
            }
          | null
          | Array<{
              quantity_on_hand: number;
              reserved_quantity: number;
              low_stock_threshold: number;
              is_unlimited: boolean;
              updated_at: string;
            }>;
      };

      const inv = Array.isArray(row.inventory) ? (row.inventory[0] ?? null) : row.inventory;

      return {
        productId: row.id,
        sku: row.sku,
        name: row.name,
        productType: row.product_type,
        isDigital: row.is_digital,
        quantityOnHand: inv?.quantity_on_hand ?? 0,
        reservedQuantity: inv?.reserved_quantity ?? 0,
        lowStockThreshold: inv?.low_stock_threshold ?? 5,
        isUnlimited: inv?.is_unlimited ?? false,
        updatedAt: inv?.updated_at ?? null,
        reserved: inv?.reserved_quantity ?? 0,
      } satisfies InventoryRow;
    });

    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEditor = (row: InventoryRow) => {
    setEditing(row);
    setQuantity(String(row.quantityOnHand));
    setThreshold(String(row.lowStockThreshold));
    setUnlimited(row.isUnlimited);
    setNote("");
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);

    const outcome = await invokeFunction<{ status?: string; reasonText?: string }>("admin-actions", {
      action: "set_stock",
      productId: editing.productId,
      quantity: Number(quantity) || 0,
      lowStockThreshold: Number(threshold) || 0,
      isUnlimited: unlimited || editing.isDigital,
      reason: note.trim() || undefined,
    });

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "Stock could not be saved");
      return;
    }

    toast.success(outcome.data?.reasonText ?? "Stock updated");
    setEditing(null);
    void load();
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.sku.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle) ||
        row.productType.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const columns: Array<Column<InventoryRow>> = [
    {
      key: "product",
      header: "Product",
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{row.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{row.sku}</p>
        </div>
      ),
    },
    {
      key: "onHand",
      header: "On hand",
      cell: (row) => <span className="tabular-nums">{row.quantityOnHand}</span>,
    },
    {
      key: "reserved",
      header: "Reserved",
      cell: (row) => <span className="tabular-nums">{row.reservedQuantity}</span>,
    },
    {
      key: "available",
      header: "Available",
      cell: (row) =>
        row.isUnlimited ? (
          <StatusBadge label="Unlimited" tone="info" />
        ) : (
          <span className="font-semibold tabular-nums">
            {Math.max(row.quantityOnHand - row.reservedQuantity, 0)}
          </span>
        ),
    },
    {
      key: "state",
      header: "State",
      cell: (row) => {
        if (row.isDigital) return <StatusBadge label="Digital" tone="info" />;
        if (row.isUnlimited) return <StatusBadge label="Unlimited" tone="info" />;
        const available = Math.max(row.quantityOnHand - row.reservedQuantity, 0);
        if (available === 0) return <StatusBadge label="Out of stock" tone="danger" />;
        if (available <= row.lowStockThreshold) return <StatusBadge label="Low stock" tone="warning" />;
        return <StatusBadge label="In stock" tone="success" />;
      },
    },
    {
      key: "updated",
      header: "Last change",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDateTime(row.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      cell: (row) => (
        <div className="text-right">
          <Button type="button" variant="outline" size="sm" onClick={() => openEditor(row)}>
            Adjust
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock is reserved when a customer orders and only leaves the shelf once the payment is verified. Reserved units are already spoken for."
        actions={<ExportButton dataset="inventory" filters={{ search: search || null }} />}
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by product or SKU" />
        <p className="text-xs text-muted-foreground">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.productId}
        loading={loading}
        empty={
          <EmptyState
            icon={Boxes}
            title="No products found"
            description="Add a product in the catalogue and its stock row will appear here."
          />
        }
      />

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? undefined : setEditing(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {editing?.name} · {editing?.sku}. Every change is recorded as a stock movement and
              written to the audit log.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="stock-qty">Units on hand</Label>
                <Input
                  id="stock-qty"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1.5"
                />
                {editing && Number(quantity) < editing.reservedQuantity ? (
                  <p className="mt-1.5 text-[11px] text-destructive">
                    Cannot go below the {editing.reservedQuantity} unit(s) already reserved for open
                    orders.
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="stock-threshold">Low-stock alert at</Label>
                <Input
                  id="stock-threshold"
                  inputMode="numeric"
                  value={threshold}
                  onChange={(event) => setThreshold(event.target.value.replace(/[^0-9]/g, ""))}
                  className="mt-1.5"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  The available count shown to customers is measured against this threshold.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Unlimited</p>
                <p className="text-[11px] text-muted-foreground">
                  {editing?.isDigital
                    ? "Digital products are never stock-limited."
                    : "Turned on for products that are never stock-limited."}
                </p>
              </div>
              <Switch
                checked={unlimited || Boolean(editing?.isDigital)}
                disabled={Boolean(editing?.isDigital)}
                onCheckedChange={setUnlimited}
              />
            </div>

            <div>
              <Label htmlFor="stock-note">Reason</Label>
              <Input
                id="stock-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-1.5"
                placeholder="New stock delivery, stock count correction, damaged units…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
