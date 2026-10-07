import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invokeFunction } from "@/lib/kmd/invoke";
import { formatPeso } from "@/lib/kmd/format";

interface Product {
  id: string;
  sku: string;
  name: string;
  product_type: string;
  selling_price: number;
}

interface Component {
  productId: string;
  quantity: number;
}

/**
 * Bundle composition.
 *
 * The reward policy decides whether a bundle purchase is rewarded from the
 * bundle's own reward row or from its components; the current policy is shown
 * here so the administrator can see which one applies before saving.
 */
export default function AdminBundles() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [policy, setPolicy] = useState("bundle_sku");
  const [bundleId, setBundleId] = useState("");
  const [components, setComponents] = useState<Component[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: productRows, error: productError }, { data: setting }] = await Promise.all([
      supabase.from("products").select("id, sku, name, product_type, selling_price").order("sort_order"),
      supabase.from("system_settings").select("value").eq("key", "bundle_reward_policy").maybeSingle(),
    ]);

    if (productError) {
      console.error("Could not load products:", productError.message);
      setProducts([]);
    } else {
      setProducts((productRows ?? []) as Product[]);
    }

    const raw = (setting as { value?: unknown } | null)?.value;
    setPolicy(typeof raw === "string" ? raw : "bundle_sku");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadBundle = useCallback(async (productId: string) => {
    if (!productId) {
      setComponents([]);
      return;
    }
    const { data, error } = await supabase
      .from("bundle_components")
      .select("component_product_id, quantity")
      .eq("bundle_product_id", productId);

    if (error) {
      console.error("Could not load the bundle:", error.message);
      setComponents([]);
      return;
    }

    setComponents(
      (data ?? []).map((row) => ({
        productId: (row as { component_product_id: string }).component_product_id,
        quantity: (row as { quantity: number }).quantity,
      })),
    );
    setLoadedFor(productId);
  }, []);

  useEffect(() => {
    void loadBundle(bundleId);
  }, [bundleId, loadBundle]);

  const save = async () => {
    if (!bundleId) {
      toast.error("Choose the bundle product first");
      return;
    }
    setBusy(true);

    const outcome = await invokeFunction<{ componentCount?: number; reasonText?: string }>(
      "admin-actions",
      {
        action: "set_bundle",
        bundleProductId: bundleId,
        components,
      },
    );

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The bundle could not be saved");
      return;
    }
    toast.success(outcome.data?.reasonText ?? "Bundle saved");
    void loadBundle(bundleId);
  };

  const bundleOptions = products.filter((product) => product.product_type !== "digital");
  const chosen = products.find((product) => product.id === bundleId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bundles and combinations"
        description="Define what a bundle contains. Reward policy is configured in Settings."
      />

      <div className="kmd-panel p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px]">
            <p className="kmd-label">Bundle product</p>
            <Select value={bundleId} onValueChange={setBundleId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a product to compose" />
              </SelectTrigger>
              <SelectContent>
                {bundleOptions.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="kmd-panel-quiet px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reward policy in force
            </p>
            <p className="mt-1 text-sm font-semibold">
              {policy === "components"
                ? "Reward the component SKUs"
                : "Reward the bundle SKU and ignore its components"}
            </p>
            <p className="mt-1 max-w-md text-[11px] text-muted-foreground">
              Changing this in Settings changes how future bundle purchases pay. Orders already
              processed are never recalculated.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : !bundleId ? (
        <EmptyState
          icon={Layers}
          title="Choose a bundle to compose"
          description="Pick the product that customers buy, then list what it is made of."
        />
      ) : (
        <div className="kmd-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{chosen?.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {chosen?.sku} · sells for {formatPeso(chosen?.selling_price ?? 0)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setComponents((current) => [...current, { productId: "", quantity: 1 }])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add a component
            </Button>
          </div>

          {components.length === 0 ? (
            <p className="mt-6 text-xs text-muted-foreground">
              {loadedFor === bundleId
                ? "This bundle has no components yet."
                : "Loading the composition…"}
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {components.map((component, index) => (
                <li key={`${component.productId}-${index}`} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <p className="kmd-label">Component</p>
                    <Select
                      value={component.productId}
                      onValueChange={(value) =>
                        setComponents((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, productId: value } : row,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Choose a product" />
                      </SelectTrigger>
                      <SelectContent>
                        {bundleOptions
                          .filter((product) => product.id !== bundleId)
                          .map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} · {product.sku}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-28">
                    <p className="kmd-label">Quantity</p>
                    <Input
                      inputMode="numeric"
                      value={component.quantity}
                      onChange={(event) =>
                        setComponents((current) =>
                          current.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  quantity: Math.max(
                                    1,
                                    Number(event.target.value.replace(/[^0-9]/g, "")) || 1,
                                  ),
                                }
                              : row,
                          ),
                        )
                      }
                      className="mt-1.5"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setComponents((current) => current.filter((_, rowIndex) => rowIndex !== index))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="brand"
            className="mt-6"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save composition
          </Button>
        </div>
      )}
    </div>
  );
}
