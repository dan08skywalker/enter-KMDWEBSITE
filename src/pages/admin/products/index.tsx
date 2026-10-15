import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { ExportButton } from "@/components/kmd/export-button";
import { ConfirmActionDialog } from "@/components/kmd/confirm-action-dialog";
import { FilterBar, SearchInput } from "@/components/kmd/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPeso } from "@/lib/kmd/format";

interface CatalogueProduct {
  id: string;
  product_code: string;
  name: string;
  sku: string;
  slug: string | null;
  category: string;
  product_type: string;
  brand: string | null;
  short_description: string | null;
  description: string | null;
  disclaimer: string | null;
  image_url: string | null;
  regular_price: number | null;
  promo_price: number | null;
  selling_price: number;
  is_active: boolean;
  is_digital: boolean;
  track_inventory: boolean;
  sort_order: number;
}

interface ProductForm {
  id?: string;
  productCode: string;
  name: string;
  sku: string;
  slug: string;
  category: string;
  productType: string;
  brand: string;
  shortDescription: string;
  description: string;
  disclaimer: string;
  imageUrl: string;
  regularPrice: string;
  promoPrice: string;
  sortOrder: string;
  isActive: boolean;
  isDigital: boolean;
  trackInventory: boolean;
}

const EMPTY: ProductForm = {
  productCode: "",
  name: "",
  sku: "",
  slug: "",
  category: "Wellness",
  productType: "retail",
  brand: "",
  shortDescription: "",
  description: "",
  disclaimer: "",
  imageUrl: "",
  regularPrice: "",
  promoPrice: "",
  sortOrder: "0",
  isActive: true,
  isDigital: false,
  trackInventory: true,
};

const PRODUCT_TYPES = [
  { value: "retail", label: "Retail product" },
  { value: "reorder", label: "Member reorder" },
  { value: "digital", label: "Digital service" },
  { value: "bundle", label: "Bundle" },
  { value: "membership", label: "Membership bundle" },
];

export default function AdminProducts() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<CatalogueProduct[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CatalogueProduct | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order")
      .order("product_code");

    if (error) {
      console.error("Could not load the catalogue:", error.message);
      setProducts([]);
    } else {
      setProducts((data ?? []) as CatalogueProduct[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY });
  };

  const openEdit = (product: CatalogueProduct) => {
    setEditing(product);
    setForm({
      id: product.id,
      productCode: product.product_code,
      name: product.name,
      sku: product.sku,
      slug: product.slug ?? "",
      category: product.category,
      productType: product.product_type,
      brand: product.brand ?? "",
      shortDescription: product.short_description ?? "",
      description: product.description ?? "",
      disclaimer: product.disclaimer ?? "",
      imageUrl: product.image_url ?? "",
      regularPrice: product.regular_price === null ? "" : String(product.regular_price),
      promoPrice: product.promo_price === null ? "" : String(product.promo_price),
      sortOrder: String(product.sort_order),
      isActive: product.is_active,
      isDigital: product.is_digital,
      trackInventory: product.track_inventory,
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("A product name is required");
      return;
    }
    if (!form.id && (!form.productCode.trim() || !form.sku.trim())) {
      toast.error("Product code and SKU are required for a new product");
      return;
    }
    if (Number(form.regularPrice || 0) > 0 && Number(form.promoPrice || 0) > Number(form.regularPrice)) {
      toast.error("The promotional price cannot be higher than the regular price");
      return;
    }

    setBusy(true);
    const outcome = await invokeFunction<{ sellingPrice?: number; reasonText?: string }>(
      "admin-actions",
      {
        action: "save_product",
        payload: {
          id: form.id ?? null,
          productCode: form.productCode.trim() || null,
          name: form.name.trim(),
          sku: form.sku.trim() || null,
          slug: form.slug.trim() || null,
          category: form.category.trim() || "General",
          productType: form.productType,
          brand: form.brand.trim() || null,
          shortDescription: form.shortDescription.trim() || null,
          description: form.description.trim() || null,
          disclaimer: form.disclaimer.trim() || null,
          imageUrl: form.imageUrl.trim() || null,
          regularPrice: form.regularPrice.trim() === "" ? null : Number(form.regularPrice),
          promoPrice: form.promoPrice.trim() === "" ? null : Number(form.promoPrice),
          sortOrder: Number(form.sortOrder) || 0,
          isActive: form.isActive,
          isDigital: form.isDigital,
          trackInventory: form.trackInventory,
        },
      },
    );
    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The product could not be saved");
      return;
    }

    toast.success(
      outcome.data?.reasonText
        ? `${outcome.data.reasonText} Charged price: ${formatPeso(outcome.data.sellingPrice ?? 0)}`
        : "Product saved",
    );
    setForm(null);
    void load();
  };

  const setVisibility = async (product: CatalogueProduct, isActive: boolean, reason?: string) => {
    const outcome = await invokeFunction<{ reasonText?: string }>("admin-actions", {
      action: "set_product_visibility",
      productId: product.id,
      isActive,
      reason,
    });

    if (!outcome.ok) {
      const message = outcome.error ?? "The visibility change could not be saved";
      toast.error(message);
      return { error: message };
    }

    toast.success(
      outcome.data?.reasonText ??
        `${product.name} is now ${isActive ? "visible in the shop" : "hidden from the shop"}`,
    );
    void load();
    return {};
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        product.product_code.toLowerCase().includes(needle) ||
        product.category.toLowerCase().includes(needle),
    );
  }, [products, search]);

  const columns: Array<Column<CatalogueProduct>> = [
    {
      key: "product",
      header: "Product",
      cell: (product) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-secondary">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                crossOrigin="anonymous"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              {product.sku} · {product.product_code}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (product) => (
        <StatusBadge
          label={product.product_type}
          tone={product.product_type === "membership" ? "gold" : "info"}
        />
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (product) => <span className="text-xs">{product.category}</span>,
    },
    {
      key: "price",
      header: "Price",
      cell: (product) => (
        <div className="text-xs">
          <p className="font-semibold tabular-nums">{formatPeso(product.selling_price)}</p>
          {product.regular_price !== null && product.regular_price > product.selling_price ? (
            <p className="text-[10px] text-muted-foreground line-through tabular-nums">
              {formatPeso(product.regular_price)}
            </p>
          ) : null}
          {product.selling_price <= 0 ? (
            <p className="text-[10px] font-semibold text-warning">Cannot be sold yet</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "visibility",
      header: "Visibility",
      cell: (product) =>
        product.is_active ? (
          <StatusBadge label="Visible" tone="success" />
        ) : (
          <StatusBadge label="Hidden" tone="warning" />
        ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      cell: (product) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(product)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          {product.is_active ? (
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide Product
                </Button>
              }
              title={`Hide ${product.name}?`}
              description="Customers immediately stop seeing it in the shop, search, categories and featured sections, and it can no longer be purchased — including through a direct product link or a cart that already holds it. Its details, images, price, stock count and previous orders are all kept, and you can show it again at any time."
              confirmLabel="Hide Product"
              reasonRequired
              reasonLabel="Reason (recorded on the audit log)"
              onConfirm={(reason) => setVisibility(product, false, reason)}
            />
          ) : (
            <ConfirmActionDialog
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <Eye className="h-3.5 w-3.5" />
                  Show Product
                </Button>
              }
              title={`Show ${product.name}?`}
              description="It returns to the shop and becomes purchasable again, using its existing stock and purchase rules. Stock quantity is not changed by this action."
              confirmLabel="Show Product"
              onConfirm={() => setVisibility(product, true)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue"
        description="Products, prices and presentation. The promotional price is what checkout charges; the regular price is what it replaces."
        actions={
          <>
            <ExportButton dataset="inventory" label="Export stock" filters={{ search: search || null }} />
            <Button type="button" variant="brand" size="sm" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" />
              New product
            </Button>
          </>
        }
      />

      <FilterBar>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, SKU, code or category"
        />
        <p className="text-xs text-muted-foreground">
          {filtered.length} product{filtered.length === 1 ? "" : "s"}
        </p>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(product) => product.id}
        loading={loading}
        empty={
          <EmptyState
            icon={ShoppingBag}
            title="No products match"
            description="Clear the search or add a new product."
          />
        }
      />

      {form ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">
            {editing ? `Edit ${editing.name}` : "New product"}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="product-name">Product name</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="product-code">Product code</Label>
              <Input
                id="product-code"
                value={form.productCode}
                onChange={(event) => setForm({ ...form, productCode: event.target.value })}
                className="mt-1.5 font-mono"
                disabled={Boolean(editing)}
              />
              {editing ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  The code is fixed after creation so reward configuration stays attached.
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                className="mt-1.5 font-mono"
                disabled={Boolean(editing)}
              />
            </div>

            <div>
              <Label htmlFor="product-slug">Public URL slug</Label>
              <Input
                id="product-slug"
                value={form.slug}
                onChange={(event) =>
                  setForm({
                    ...form,
                    slug: event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, ""),
                  })
                }
                className="mt-1.5 font-mono"
                placeholder="dokudami-capsules"
              />
            </div>
            <div>
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="product-type">Product type</Label>
              <Select
                value={form.productType}
                onValueChange={(value) => setForm({ ...form, productType: value })}
              >
                <SelectTrigger id="product-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product-brand">Brand</Label>
              <Input
                id="product-brand"
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
                className="mt-1.5"
                placeholder="EGC Dokudami"
              />
            </div>

            <div>
              <Label htmlFor="product-regular">Regular price (PHP)</Label>
              <Input
                id="product-regular"
                inputMode="decimal"
                value={form.regularPrice}
                onChange={(event) =>
                  setForm({ ...form, regularPrice: event.target.value.replace(/[^0-9.]/g, "") })
                }
                className="mt-1.5"
                placeholder="3000"
              />
            </div>
            <div>
              <Label htmlFor="product-promo">Promotional price (PHP)</Label>
              <Input
                id="product-promo"
                inputMode="decimal"
                value={form.promoPrice}
                onChange={(event) =>
                  setForm({ ...form, promoPrice: event.target.value.replace(/[^0-9.]/g, "") })
                }
                className="mt-1.5"
                placeholder="1850"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Leave the promotional price blank to charge the regular price.
              </p>
            </div>

            <div>
              <Label htmlFor="product-image">Image URL</Label>
              <Input
                id="product-image"
                value={form.imageUrl}
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                className="mt-1.5"
                placeholder="/products/dokudami.png"
              />
            </div>
            <div>
              <Label htmlFor="product-sort">Sort order</Label>
              <Input
                id="product-sort"
                inputMode="numeric"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm({ ...form, sortOrder: event.target.value.replace(/[^0-9-]/g, "") })
                }
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="product-eyebrow">Short description</Label>
              <Input
                id="product-eyebrow"
                value={form.shortDescription}
                onChange={(event) => setForm({ ...form, shortDescription: event.target.value })}
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="product-description">Full description</Label>
              <Textarea
                id="product-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="product-disclaimer">Disclaimer shown on the product page</Label>
              <Textarea
                id="product-disclaimer"
                value={form.disclaimer}
                onChange={(event) => setForm({ ...form, disclaimer: event.target.value })}
                rows={2}
                className="mt-1.5"
                placeholder="This product is a food supplement. It is not intended to diagnose, treat, cure or prevent any disease."
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Active</p>
                <p className="text-[11px] text-muted-foreground">Shown on the public site.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Digital</p>
                <p className="text-[11px] text-muted-foreground">No delivery fee or stock.</p>
              </div>
              <Switch
                checked={form.isDigital}
                onCheckedChange={(checked) => setForm({ ...form, isDigital: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Track stock</p>
                <p className="text-[11px] text-muted-foreground">Reserve units at checkout.</p>
              </div>
              <Switch
                checked={form.trackInventory}
                onCheckedChange={(checked) => setForm({ ...form, trackInventory: checked })}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save product
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
