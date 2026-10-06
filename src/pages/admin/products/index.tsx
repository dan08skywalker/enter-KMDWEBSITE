import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { DataTable, type Column } from "@/components/kmd/data-table";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPeso } from "@/lib/kmd/format";
import type { Product } from "@/lib/kmd/types";

interface ProductForm {
  productCode: string;
  name: string;
  sku: string;
  membershipCode: string;
  category: string;
  productType: string;
  sellingPrice: string;
  isActive: boolean;
}

const EMPTY_FORM: ProductForm = {
  productCode: "",
  name: "",
  sku: "",
  membershipCode: "",
  category: "",
  productType: "membership",
  sellingPrice: "0",
  isActive: true,
};

export default function AdminProducts() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("product_code");
    if (error) console.error("Could not load products:", error.message);
    setProducts((data ?? []) as unknown as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      productCode: product.product_code,
      name: product.name,
      sku: product.sku,
      membershipCode: product.membership_code ?? "",
      category: product.category,
      productType: product.product_type,
      sellingPrice: String(product.selling_price),
      isActive: product.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim() || (!editing && !form.productCode.trim())) {
      toast.error("Product code, name and SKU are required");
      return;
    }

    setBusy(true);
    const outcome = editing
      ? await invokeFunction("admin-actions", {
          action: "update_product",
          productId: editing.id,
          name: form.name,
          sku: form.sku,
          membershipCode: form.membershipCode,
          category: form.category,
          productType: form.productType,
          sellingPrice: Number(form.sellingPrice) || 0,
          isActive: form.isActive,
        })
      : await invokeFunction("admin-actions", {
          action: "create_product",
          productCode: form.productCode,
          name: form.name,
          sku: form.sku,
          membershipCode: form.membershipCode,
          category: form.category,
          productType: form.productType,
          sellingPrice: Number(form.sellingPrice) || 0,
          isActive: form.isActive,
        });
    setBusy(false);

    if (!outcome.ok) {
      toast.error("Could not save the product", { description: outcome.error });
      return;
    }
    toast.success(editing ? "Product saved and audited" : "Product created with a zero reward row", {
      description: editing ? undefined : "Set its commission values in Reward Configuration.",
    });
    setDialogOpen(false);
    await load();
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      `${product.product_code} ${product.name} ${product.sku} ${product.category}`
        .toLowerCase()
        .includes(needle),
    );
  }, [products, search]);

  const columns: Column<Product>[] = [
    { key: "code", header: "Product ID", cell: (row) => <span className="font-mono text-xs">{row.product_code}</span> },
    { key: "name", header: "Product Name", cell: (row) => <span className="text-sm font-medium">{row.name}</span> },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.sku}</span> },
    { key: "membership", header: "Membership Code", cell: (row) => <span className="font-mono text-xs">{row.membership_code ?? "\u2014"}</span> },
    { key: "category", header: "Category", cell: (row) => row.category },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <StatusBadge
          label={row.product_type === "membership" ? "Membership" : row.product_type === "reorder" ? "Reorder" : "Bundle"}
          tone={row.product_type === "membership" ? "gold" : "info"}
        />
      ),
    },
    { key: "price", header: "Selling Price", cell: (row) => formatPeso(row.selling_price), className: "text-right" },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge label={row.is_active ? "Active" : "Inactive"} tone={row.is_active ? "success" : "neutral"} />
      ),
    },
    { key: "updated", header: "Updated", cell: (row) => formatDate(row.updated_at) },
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
        title="Products"
        description="The catalogue that orders and the reward engine key on. Commission values live in Reward Configuration, not here."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        }
      />

      <div className="kmd-panel border-dashed p-4">
        <p className="text-xs text-muted-foreground">
          Every order permanently stores the product ID, SKU and quantity, so changing a product name
          never changes a past calculation. A product with no configured commission produces no ledger
          rows — it simply earns nothing until the matrix is filled in.
        </p>
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search code, name, SKU or category" />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        empty={<EmptyState icon={ShoppingBag} title="No products" description="Create your first product to start selling." action={<Button onClick={openNew}>New product</Button>} />}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes are recorded on the audit log."
                : "The product is created with an all-zero reward row so you can configure its commission next."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-code">Product ID</Label>
              <Input
                id="product-code"
                value={form.productCode}
                onChange={(event) => setForm({ ...form, productCode: event.target.value })}
                disabled={Boolean(editing)}
                placeholder="KMD-PROD-0006"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sku">SKU</Label>
              <Input
                id="product-sku"
                value={form.sku}
                onChange={(event) => setForm({ ...form, sku: event.target.value })}
                placeholder="KMD-XXXX-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-membership">Membership Code</Label>
              <Input
                id="product-membership"
                value={form.membershipCode}
                onChange={(event) => setForm({ ...form, membershipCode: event.target.value })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-category">Category</Label>
              <Input
                id="product-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Membership Bundle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-type">Product Type</Label>
              <Select value={form.productType} onValueChange={(value) => setForm({ ...form, productType: value })}>
                <SelectTrigger id="product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membership">Membership</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                  <SelectItem value="reorder">Reorder</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-price">Selling Price</Label>
              <Input
                id="product-price"
                inputMode="decimal"
                value={form.sellingPrice}
                onChange={(event) =>
                  setForm({ ...form, sellingPrice: event.target.value.replace(/[^0-9.]/g, "") })
                }
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="product-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label htmlFor="product-active" className="cursor-pointer text-sm">
                Active and available for orders
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save product" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
