import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Pencil, Plus } from "lucide-react";
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
import { packageTier } from "@/lib/kmd/labels";
import type { MembershipPackage, Product } from "@/lib/kmd/types";

interface PackageRow extends MembershipPackage {
  productName: string | null;
  productSku: string | null;
}

interface PackageForm {
  packageCode: string;
  name: string;
  tier: string;
  productId: string;
  isActive: boolean;
}

const EMPTY_FORM: PackageForm = {
  packageCode: "",
  name: "",
  tier: "trial",
  productId: "",
  isActive: true,
};

export default function AdminPackages() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [form, setForm] = useState<PackageForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [packageResult, productResult] = await Promise.all([
      supabase.from("membership_packages").select("*").order("package_code"),
      supabase.from("products").select("*").order("product_code"),
    ]);

    if (packageResult.error) console.error("Could not load packages:", packageResult.error.message);
    if (productResult.error) console.error("Could not load products:", productResult.error.message);

    const productRows = (productResult.data ?? []) as unknown as Product[];
    setProducts(productRows);

    const lookup = new Map(productRows.map((product) => [product.id, product]));
    setRows(
      ((packageResult.data ?? []) as unknown as MembershipPackage[]).map((pkg) => ({
        ...pkg,
        productName: lookup.get(pkg.product_id)?.name ?? null,
        productSku: lookup.get(pkg.product_id)?.sku ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, productId: products[0]?.id ?? "" });
    setDialogOpen(true);
  };

  const openEdit = (row: PackageRow) => {
    setEditing(row);
    setForm({
      packageCode: row.package_code,
      name: row.name,
      tier: row.tier,
      productId: row.product_id,
      isActive: row.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || (!editing && !form.packageCode.trim())) {
      toast.error("Package code and name are required");
      return;
    }
    if (!form.productId) {
      toast.error("Select the product this package issues");
      return;
    }

    setBusy(true);
    const outcome = editing
      ? await invokeFunction("admin-actions", {
          action: "update_package",
          packageId: editing.id,
          name: form.name,
          tier: form.tier,
          productId: form.productId,
          isActive: form.isActive,
        })
      : await invokeFunction("admin-actions", {
          action: "create_package",
          packageCode: form.packageCode,
          name: form.name,
          tier: form.tier,
          productId: form.productId,
          isActive: form.isActive,
        });
    setBusy(false);

    if (!outcome.ok) {
      toast.error("Could not save the package", { description: outcome.error });
      return;
    }
    toast.success("Package saved and audited");
    setDialogOpen(false);
    await load();
  };

  const columns: Column<PackageRow>[] = [
    { key: "code", header: "Package Code", cell: (row) => <span className="font-mono text-xs">{row.package_code}</span> },
    { key: "name", header: "Package Name", cell: (row) => <span className="text-sm font-medium">{row.name}</span> },
    {
      key: "tier",
      header: "Tier",
      cell: (row) => <StatusBadge label={packageTier(row.tier).label} tone={packageTier(row.tier).tone} />,
    },
    { key: "product", header: "Linked Product", cell: (row) => row.productName ?? "\u2014" },
    { key: "sku", header: "SKU", cell: (row) => <span className="font-mono text-xs">{row.productSku ?? "\u2014"}</span> },
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

  return (
    <>
      <PageHeader
        title="Membership Packages"
        description="Packages link a tier to a product. The tier decides the loyalty card artwork a member sees."
        actions={
          <Button onClick={openNew} disabled={products.length === 0}>
            <Plus className="h-4 w-4" />
            New package
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          <EmptyState
            icon={GraduationCap}
            title="No membership packages"
            description="Create a package and link it to a product so purchases can issue a loyalty card."
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
            <DialogDescription>
              Package changes are written to the audit log. The tier controls the card design shown to
              members (Trial, Classic, Gold, Platinum).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="package-code">Package Code</Label>
              <Input
                id="package-code"
                value={form.packageCode}
                onChange={(event) => setForm({ ...form, packageCode: event.target.value })}
                disabled={Boolean(editing)}
                placeholder="KMD-PKG-TRIAL"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-name">Package Name</Label>
              <Input
                id="package-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Gold Loyalty Card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-tier">Tier</Label>
              <Select value={form.tier} onValueChange={(value) => setForm({ ...form, tier: value })}>
                <SelectTrigger id="package-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="package-product">Linked Product</Label>
              <Select value={form.productId} onValueChange={(value) => setForm({ ...form, productId: value })}>
                <SelectTrigger id="package-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="package-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label htmlFor="package-active" className="cursor-pointer text-sm">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Save package" : "Create package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
