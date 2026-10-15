import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Coins, Loader2, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPoints } from "@/lib/kmd/format";
import { LOYALTY_BENEFICIARY_LEVELS, UNILEVEL_LEVELS } from "@/lib/kmd/constants";
import type { Product, RewardConfiguration } from "@/lib/kmd/types";

interface MatrixRow extends RewardConfiguration {
  product: Product | null;
}

interface ConfigForm {
  level1: string;
  level2: string;
  level3: string;
  level4: string;
  level5: string;
  level6: string;
  level7: string;
  level8: string;
  level9: string;
  level10: string;
  loyaltyCredit: string;
  loyaltyBeneficiaryLevel: string;
  isActive: boolean;
}

export default function AdminRewardConfiguration() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [editing, setEditing] = useState<MatrixRow | null>(null);
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [configResult, productResult] = await Promise.all([
      supabase.from("reward_configurations").select("*").order("sku"),
      supabase.from("products").select("*"),
    ]);

    if (configResult.error) console.error("Could not load the matrix:", configResult.error.message);
    if (productResult.error) console.error("Could not load products:", productResult.error.message);

    const productLookup = new Map(
      ((productResult.data ?? []) as unknown as Product[]).map((product) => [product.id, product]),
    );

    setRows(
      ((configResult.data ?? []) as unknown as RewardConfiguration[])
        .map((config) => ({ ...config, product: productLookup.get(config.product_id) ?? null }))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openEdit = (row: MatrixRow) => {
    setEditing(row);
    setForm({
      level1: String(row.level1_points),
      level2: String(row.level2_points),
      level3: String(row.level3_points),
      level4: String(row.level4_points),
      level5: String(row.level5_points),
      level6: String(row.level6_points),
      level7: String(row.level7_points),
      level8: String(row.level8_points),
      level9: String(row.level9_points),
      level10: String(row.level10_points),
      loyaltyCredit: String(row.loyalty_credit),
      loyaltyBeneficiaryLevel: String(row.loyalty_beneficiary_level),
      isActive: row.is_active,
    });
  };

  const save = async () => {
    if (!editing || !form) return;
    setBusy(true);
    const outcome = await invokeFunction("admin-actions", {
      action: "update_reward_config",
      productId: editing.product_id,
      level1: Number(form.level1) || 0,
      level2: Number(form.level2) || 0,
      level3: Number(form.level3) || 0,
      level4: Number(form.level4) || 0,
      level5: Number(form.level5) || 0,
      level6: Number(form.level6) || 0,
      level7: Number(form.level7) || 0,
      level8: Number(form.level8) || 0,
      level9: Number(form.level9) || 0,
      level10: Number(form.level10) || 0,
      loyaltyCredit: Number(form.loyaltyCredit) || 0,
      loyaltyBeneficiaryLevel: Number(form.loyaltyBeneficiaryLevel) || 1,
      isActive: form.isActive,
    });
    setBusy(false);

    if (!outcome.ok) {
      toast.error("Could not save the configuration", { description: outcome.error });
      return;
    }
    toast.success("Reward configuration saved", {
      description: "The change is recorded on the audit log. Past ledger entries are never rewritten.",
    });
    setEditing(null);
    setForm(null);
    await load();
  };

  const unconfigured = useMemo(
    () =>
      rows.filter(
        (row) =>
          Number(row.level1_points) === 0 &&
          Number(row.level2_points) === 0 &&
          Number(row.level3_points) === 0 &&
          Number(row.level4_points) === 0 &&
          Number(row.level5_points) === 0,
      ),
    [rows],
  );

  const unilevelColumns: Column<MatrixRow>[] = [
    { key: "product", header: "Product", cell: (row) => <span className="text-sm font-medium">{row.product?.name ?? row.sku}</span> },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    ...UNILEVEL_LEVELS.map((level) => ({
      key: `level${level}`,
      header: `Level ${level} Points`,
      className: "text-right",
      cell: (row: MatrixRow) => (
        <span className={`tabular-nums ${Number(row[`level${level}_points` as keyof RewardConfiguration]) === 0 ? "text-muted-foreground" : "font-semibold"}`}>
          {formatPoints(row[`level${level}_points` as keyof RewardConfiguration] as number)}
        </span>
      ),
    })),
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge label={row.is_active ? "Active" : "Inactive"} tone={row.is_active ? "success" : "neutral"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
  ];

  const loyaltyColumns: Column<MatrixRow>[] = [
    { key: "product", header: "Product", cell: (row) => <span className="text-sm font-medium">{row.product?.name ?? row.sku}</span> },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    {
      key: "credit",
      header: "Loyalty Credit",
      className: "text-right",
      cell: (row) => (
        <span className={`tabular-nums ${Number(row.loyalty_credit) === 0 ? "text-muted-foreground" : "font-semibold"}`}>
          {formatPoints(row.loyalty_credit)}
        </span>
      ),
    },
    {
      key: "beneficiary",
      header: "Beneficiary Level",
      cell: (row) => <StatusBadge label={`Level ${row.loyalty_beneficiary_level}`} tone="gold" />,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge label={row.is_active ? "Active" : "Inactive"} tone={row.is_active ? "success" : "neutral"} />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
  ];

  const fullColumns: Column<MatrixRow>[] = [
    ...unilevelColumns.filter((column) => column.key !== "actions"),
    {
      key: "loyalty",
      header: "Loyalty Credit",
      className: "text-right",
      cell: (row) => formatPoints(row.loyalty_credit),
    },
    {
      key: "price",
      header: "Selling Price",
      className: "text-right",
      cell: (row) => formatPoints(row.product?.selling_price ?? 0),
    },
    { key: "updated", header: "Last Updated", cell: (row) => formatDate(row.updated_at) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (row) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reward Configuration"
        description="The unilevel and loyalty matrix. Change any compensation value here without touching source code — every change is audited."
      />

      <div className="kmd-panel border-gold/40 bg-gold/8 p-4">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--gold))]" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Set every level to what your plan actually pays, including Level 6 to Level 10.</p>
            <p className="text-muted-foreground">
              The plan now compensates ten levels. The system never invents a value: a level set to 0
              deliberately pays nothing and creates no ledger row, which is a valid configuration —
              several products are configured that way beyond the levels they actually pay. Changing a
              value affects future qualified purchases only, and never rewrites ledger entries that were
              already posted.
            </p>
          </div>
        </div>
      </div>

      {unconfigured.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {unconfigured.length} product{unconfigured.length > 1 ? "s have" : " has"} every level at 0 and
          currently earns nothing: {unconfigured.map((row) => row.sku).join(", ")}
        </p>
      ) : null}

      <Tabs defaultValue="unilevel">
        <TabsList>
          <TabsTrigger value="unilevel">
            <Coins className="mr-1.5 h-3.5 w-3.5" />
            Unilevel Matrix
          </TabsTrigger>
          <TabsTrigger value="loyalty">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Loyalty Credit
          </TabsTrigger>
          <TabsTrigger value="full">Full Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="unilevel" className="mt-4">
          <DataTable
            columns={unilevelColumns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={loading}
            empty={<EmptyState icon={Coins} title="No reward configuration" description="Create a product to generate its reward row." />}
          />
        </TabsContent>

        <TabsContent value="loyalty" className="mt-4">
          <div className="kmd-panel border-dashed p-4">
            <p className="text-xs text-muted-foreground">
              Loyalty Credits are awarded to the beneficiary level you choose, are stored in their own
              ledger, and never mix with Unilevel Points.
            </p>
          </div>
          <DataTable
            columns={loyaltyColumns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={loading}
            className="mt-4"
            empty={<EmptyState icon={Sparkles} title="No loyalty configuration" />}
          />
        </TabsContent>

        <TabsContent value="full" className="mt-4">
          <DataTable
            columns={fullColumns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={loading}
            empty={<EmptyState icon={Coins} title="No reward configuration" />}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && (setEditing(null), setForm(null))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configure {editing?.product?.name ?? editing?.sku}</DialogTitle>
            <DialogDescription>
              SKU {editing?.sku}. Values are points; at the current rate 1 point equals PHP 1.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="space-y-5">
              <div>
                <p className="kmd-label">Unilevel points per qualified unit</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-5">
                  {UNILEVEL_LEVELS.map((level) => (
                    <div key={level} className="space-y-1.5">
                      <Label htmlFor={`level-${level}`} className="text-xs">
                        Level {level}
                      </Label>
                      <Input
                        id={`level-${level}`}
                        inputMode="decimal"
                        value={form[`level${level}` as keyof ConfigForm] as string}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            [`level${level}`]: event.target.value.replace(/[^0-9.]/g, ""),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="kmd-label">Loyalty credit</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="loyalty-credit" className="text-xs">
                      Loyalty Credit per qualified unit
                    </Label>
                    <Input
                      id="loyalty-credit"
                      inputMode="decimal"
                      value={form.loyaltyCredit}
                      onChange={(event) =>
                        setForm({ ...form, loyaltyCredit: event.target.value.replace(/[^0-9.]/g, "") })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loyalty-level" className="text-xs">
                      Loyalty beneficiary level
                    </Label>
                    <Select
                      value={form.loyaltyBeneficiaryLevel}
                      onValueChange={(value) => setForm({ ...form, loyaltyBeneficiaryLevel: value })}
                    >
                      <SelectTrigger id="loyalty-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOYALTY_BENEFICIARY_LEVELS.map((level) => (
                          <SelectItem key={level} value={String(level)}>
                            Level {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="config-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
                <Label htmlFor="config-active" className="cursor-pointer text-sm">
                  Configuration active
                </Label>
              </div>

              <p className="text-[11px] text-muted-foreground">
                If an order is confirmed while a product's configuration is inactive or missing, the
                confirmation is rolled back and the exact reason is reported — no partial payout is
                committed.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
