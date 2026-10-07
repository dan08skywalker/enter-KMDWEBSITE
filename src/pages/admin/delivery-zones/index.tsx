import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/kmd/page-header";
import { EmptyState } from "@/components/kmd/empty-state";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { invokeFunction } from "@/lib/kmd/invoke";
import { formatPeso } from "@/lib/kmd/format";

interface Zone {
  id: string;
  name: string;
  coverage: string | null;
  shipping_fee: number;
  free_shipping_threshold: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_configured: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ZoneForm {
  id?: string;
  name: string;
  coverage: string;
  shippingFee: string;
  freeShippingThreshold: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  isActive: boolean;
  isConfigured: boolean;
}

const EMPTY: ZoneForm = {
  name: "",
  coverage: "",
  shippingFee: "",
  freeShippingThreshold: "",
  estimatedDaysMin: "",
  estimatedDaysMax: "",
  isActive: true,
  isConfigured: false,
};

/**
 * Delivery pricing.
 *
 * A zone with no owner-supplied fee is stored as unconfigured, and checkout
 * records the order as "shipping quote pending" instead of charging a figure
 * nobody approved.
 */
export default function AdminDeliveryZones() {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState<ZoneForm | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_zones")
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("Could not load delivery zones:", error.message);
      setZones([]);
    } else {
      setZones((data ?? []) as Zone[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Give the delivery area a name");
      return;
    }
    setBusy(true);

    const outcome = await invokeFunction<{ status?: string; reasonText?: string }>("admin-actions", {
      action: "save_delivery_zone",
      payload: {
        id: form.id ?? null,
        name: form.name.trim(),
        coverage: form.coverage.trim() || null,
        shippingFee: form.shippingFee.trim() === "" ? 0 : Number(form.shippingFee),
        freeShippingThreshold:
          form.freeShippingThreshold.trim() === "" ? null : Number(form.freeShippingThreshold),
        estimatedDaysMin: form.estimatedDaysMin.trim() === "" ? null : Number(form.estimatedDaysMin),
        estimatedDaysMax: form.estimatedDaysMax.trim() === "" ? null : Number(form.estimatedDaysMax),
        isActive: form.isActive,
        isConfigured: form.isConfigured,
      },
    });

    setBusy(false);

    if (!outcome.ok) {
      toast.error(outcome.error ?? "The delivery area could not be saved");
      return;
    }

    toast.success(outcome.data?.reasonText ?? "Delivery area saved");
    setForm(null);
    void load();
  };

  const pending = zones.filter((zone) => zone.is_active && !zone.is_configured);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery & shipping"
        description="Set the fee for each area you deliver to. Until a fee is set, checkout accepts the order and marks it Shipping quote pending rather than inventing a charge."
        actions={
          <Button type="button" variant="brand" size="sm" onClick={() => setForm({ ...EMPTY })}>
            <Truck className="h-3.5 w-3.5" />
            Add a delivery area
          </Button>
        }
      />

      {pending.length > 0 ? (
        <div className="flex gap-3 rounded-xl border border-warning/35 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold">
              {pending.length} area{pending.length === 1 ? "" : "s"} still need a fee
            </p>
            <p className="mt-1 text-xs leading-relaxed text-foreground/85">
              {pending.map((zone) => zone.name).join(", ")}. Orders to these areas are saved as
              shipping quote pending. Set the fee, save, and checkout quotes it immediately.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-24 w-full" />
          ))}
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No delivery areas yet"
          description="Add at least one area so customers can choose where to have their order delivered."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {zones.map((zone) => (
            <li key={zone.id} className="kmd-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {zone.name}
                    {zone.is_active ? null : <StatusBadge label="Inactive" tone="neutral" />}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {zone.coverage ?? "No coverage note"}
                  </p>
                </div>

                {zone.is_configured ? (
                  <StatusBadge label="Fee set" tone="success" />
                ) : (
                  <StatusBadge label="Fee pending" tone="warning" />
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Delivery fee</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {zone.is_configured ? formatPeso(zone.shipping_fee) : "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Free over</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">
                    {zone.free_shipping_threshold === null
                      ? "Never"
                      : formatPeso(zone.free_shipping_threshold)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estimated days</dt>
                  <dd className="mt-0.5 font-semibold">
                    {zone.estimated_days_min === null && zone.estimated_days_max === null
                      ? "Not stated"
                      : `${zone.estimated_days_min ?? "?"}–${zone.estimated_days_max ?? "?"} days`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Checkout behaviour</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-semibold">
                    {zone.is_configured ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        Quoted
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        Quote pending
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setForm({
                    id: zone.id,
                    name: zone.name,
                    coverage: zone.coverage ?? "",
                    shippingFee: String(zone.shipping_fee ?? ""),
                    freeShippingThreshold:
                      zone.free_shipping_threshold === null
                        ? ""
                        : String(zone.free_shipping_threshold),
                    estimatedDaysMin:
                      zone.estimated_days_min === null ? "" : String(zone.estimated_days_min),
                    estimatedDaysMax:
                      zone.estimated_days_max === null ? "" : String(zone.estimated_days_max),
                    isActive: zone.is_active,
                    isConfigured: zone.is_configured,
                  })
                }
              >
                Edit this area
              </Button>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="kmd-panel p-6">
          <p className="text-sm font-semibold">
            {form.id ? "Edit delivery area" : "Add a delivery area"}
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="zone-name">Area name</Label>
              <Input
                id="zone-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-1.5"
                placeholder="Luzon"
              />
            </div>
            <div>
              <Label htmlFor="zone-coverage">Coverage note</Label>
              <Input
                id="zone-coverage"
                value={form.coverage}
                onChange={(event) => setForm({ ...form, coverage: event.target.value })}
                className="mt-1.5"
                placeholder="Metro Manila and the whole of Luzon"
              />
            </div>
            <div>
              <Label htmlFor="zone-fee">Delivery fee (PHP)</Label>
              <Input
                id="zone-fee"
                inputMode="decimal"
                value={form.shippingFee}
                onChange={(event) =>
                  setForm({ ...form, shippingFee: event.target.value.replace(/[^0-9.]/g, "") })
                }
                className="mt-1.5"
                placeholder="180"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Saving a fee marks this area as priced and unblocks checkout for it.
              </p>
            </div>
            <div>
              <Label htmlFor="zone-free">Free delivery over (PHP, optional)</Label>
              <Input
                id="zone-free"
                inputMode="decimal"
                value={form.freeShippingThreshold}
                onChange={(event) =>
                  setForm({
                    ...form,
                    freeShippingThreshold: event.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
                className="mt-1.5"
                placeholder="5000"
              />
            </div>
            <div>
              <Label htmlFor="zone-min">Estimated days, fastest</Label>
              <Input
                id="zone-min"
                inputMode="numeric"
                value={form.estimatedDaysMin}
                onChange={(event) =>
                  setForm({ ...form, estimatedDaysMin: event.target.value.replace(/[^0-9]/g, "") })
                }
                className="mt-1.5"
                placeholder="2"
              />
            </div>
            <div>
              <Label htmlFor="zone-max">Estimated days, slowest</Label>
              <Input
                id="zone-max"
                inputMode="numeric"
                value={form.estimatedDaysMax}
                onChange={(event) =>
                  setForm({ ...form, estimatedDaysMax: event.target.value.replace(/[^0-9]/g, "") })
                }
                className="mt-1.5"
                placeholder="5"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Active</p>
                <p className="text-[11px] text-muted-foreground">
                  Inactive areas are not offered at checkout.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs font-semibold">Fee confirmed</p>
                <p className="text-[11px] text-muted-foreground">
                  Turn this off to send the area back to shipping quote pending.
                </p>
              </div>
              <Switch
                checked={form.isConfigured}
                onCheckedChange={(checked) => setForm({ ...form, isConfigured: checked })}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void save()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save delivery area
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
