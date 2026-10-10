import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Loader2, MonitorSmartphone, Pencil, RefreshCw, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
import { useSiteText } from "@/contexts/store-context";
import { PageHeader } from "@/components/kmd/page-header";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatPeso, toNumber } from "@/lib/kmd/format";
import {
  MAINTENANCE_MODE_LABEL,
  mapOffering,
  type DigitalOffering,
  type FeeOption,
  type PaymentTermsMode,
} from "@/lib/digital/types";

const LEARNING_INTRO_KEY = "site.digital.learning_intro";
const SERVICES_INTRO_KEY = "site.digital.services_intro";

interface OfferingDraft {
  label: string;
  name: string;
  summary: string;
  description: string;
  inclusions: string;
  price: string;
  promoPrice: string;
  regularPrice: string;
  annualFee: string;
  annualFeeLabel: string;
  annualFeeOption: FeeOption;
  paymentTermsMode: PaymentTermsMode;
  paymentTermsNote: string;
  sortOrder: string;
  isActive: boolean;
}

function toDraft(offering: DigitalOffering): OfferingDraft {
  return {
    label: offering.label,
    name: offering.name,
    summary: offering.summary ?? "",
    description: offering.description ?? "",
    inclusions: offering.inclusions.join("\n"),
    price: String(offering.price),
    promoPrice: offering.promoPrice === null ? "" : String(offering.promoPrice),
    regularPrice: offering.regularPrice === null ? "" : String(offering.regularPrice),
    annualFee: offering.annualFee === null ? "" : String(offering.annualFee),
    annualFeeLabel: offering.annualFeeLabel ?? "",
    annualFeeOption: offering.annualFeeOption,
    paymentTermsMode: offering.paymentTermsMode,
    paymentTermsNote: offering.paymentTermsNote ?? "",
    sortOrder: String(offering.sortOrder),
    isActive: offering.isActive,
  };
}

export default function AdminDigitalOfferings() {
  const [offerings, setOfferings] = useState<DigitalOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<DigitalOffering | null>(null);
  const [draft, setDraft] = useState<OfferingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const learningIntro = useSiteText(LEARNING_INTRO_KEY, "");
  const servicesIntro = useSiteText(SERVICES_INTRO_KEY, "");
  const [learningIntroDraft, setLearningIntroDraft] = useState("");
  const [servicesIntroDraft, setServicesIntroDraft] = useState("");
  const [savingIntro, setSavingIntro] = useState(false);

  useEffect(() => {
    setLearningIntroDraft(learningIntro);
    setServicesIntroDraft(servicesIntro);
  }, [learningIntro, servicesIntro]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: readError } = await supabase
      .from("digital_offerings")
      .select("*")
      .order("offering_group")
      .order("sort_order");

    setLoading(false);
    if (readError) {
      console.error("Could not load the digital listings:", readError.message);
      toast.error("The digital listings could not be loaded");
      return;
    }
    setOfferings(((data ?? []) as Array<Record<string, unknown>>).map(mapOffering));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveIntro = async (key: string, value: string) => {
    setSavingIntro(true);
    const outcome = await invokeFunction("admin-actions", {
      action: "update_setting",
      key,
      value,
    });
    setSavingIntro(false);
    if (!outcome.ok) {
      toast.error(outcome.error ?? "The intro could not be saved");
      return;
    }
    toast.success("Intro saved", { description: "The public page shows the saved text on its next load." });
  };

  const save = async () => {
    if (!target || !draft) return;
    setError(null);

    if (!draft.name.trim()) {
      setError("Enter the listing name.");
      return;
    }
    if (draft.annualFeeOption !== "none" && (!draft.annualFee.trim() || !draft.annualFeeLabel.trim())) {
      setError("A recurring fee needs both an amount and the label it is published under.");
      return;
    }

    setBusy(true);
    const outcome = await invokeFunction<{ result?: { status?: string; reasonText?: string } }>("admin-actions", {
      action: "save_digital_offering",
      payload: {
        offeringKey: target.offeringKey,
        offeringGroup: target.offeringGroup,
        label: draft.label.trim() || target.offeringKey,
        name: draft.name.trim(),
        summary: draft.summary.trim() || null,
        description: draft.description.trim() || null,
        inclusions: draft.inclusions
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        price: toNumber(draft.price),
        promoPrice: draft.promoPrice.trim() || null,
        regularPrice: draft.regularPrice.trim() || null,
        annualFee: draft.annualFee.trim() || null,
        annualFeeLabel: draft.annualFeeLabel.trim() || null,
        annualFeeOption: draft.annualFeeOption,
        paymentTermsMode: draft.paymentTermsMode,
        paymentTermsNote: draft.paymentTermsNote.trim() || null,
        sortOrder: toNumber(draft.sortOrder, target.sortOrder),
        isActive: draft.isActive,
      },
    });
    setBusy(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The listing could not be saved.");
      return;
    }
    if (outcome.data?.result?.status !== "SAVED") {
      setError(outcome.data?.result?.reasonText ?? "The listing was refused.");
      return;
    }

    toast.success(`${draft.name} updated`, {
      description: `${formatPeso(toNumber(draft.price))}${
        draft.annualFeeOption === "none" ? "" : ` · ${draft.annualFeeLabel} ${formatPeso(toNumber(draft.annualFee))}/year`
      }`,
    });
    setTarget(null);
    setDraft(null);
    await load();
  };

  const section = (group: DigitalOffering["offeringGroup"], title: string) => {
    const rows = offerings.filter((offering) => offering.offeringGroup === group);

    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          {group === "learning_package" ? (
            <GraduationCap className="h-4 w-4 text-primary" />
          ) : (
            <MonitorSmartphone className="h-4 w-4 text-primary" />
          )}
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-[11px] text-muted-foreground">{rows.length} listings</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((offering) => (
            <div key={offering.id} className="kmd-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="kmd-eyebrow text-accent">{offering.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{offering.offeringKey}</span>
                    {!offering.isActive ? <StatusBadge label="Hidden" tone="neutral" /> : null}
                  </p>
                  <p className="mt-1 text-xs font-semibold">{offering.name}</p>
                  {offering.summary ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{offering.summary}</p>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setError(null);
                    setTarget(offering);
                    setDraft(toDraft(offering));
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              </div>

              <dl className="mt-3 grid gap-1 text-[11px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Published price</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatPeso(offering.price)}
                    {offering.regularPrice !== null ? (
                      <span className="ml-1 font-normal text-muted-foreground line-through">
                        {formatPeso(offering.regularPrice)}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Recurring charge</dt>
                  <dd className="text-right">
                    {offering.annualFee === null
                      ? "None published"
                      : `${offering.annualFeeLabel}: ${formatPeso(offering.annualFee)}/year${
                          offering.annualFeeOption === "optional" ? " (optional)" : ""
                        }`}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Payment terms</dt>
                  <dd>
                    {offering.paymentTermsMode === "project_50_50" ? "50% / 50% project" : "Product terms"}
                  </dd>
                </div>
                {offering.maintenanceOptions.length > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Maintenance</dt>
                    <dd className="text-right">
                      {offering.maintenanceOptions.map((option) => option.label).join(" or ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ))}
        </div>
      </section>
    );
  };

  return (
    <>
      <PageHeader
        title="Digital Solutions Listings"
        description="The published KMD Digital Solutions catalogue: the learning packages and the client services, with the exact prices, inclusions and recurring fees shown on the public page and carried onto every quotation."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refresh
          </Button>
        }
      />

      <div className="mt-4 kmd-panel p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-primary" />
          Section introductions
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The text shown under each heading on the KMD Digital Solutions page.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <Label htmlFor="learning-intro">Digital Products &amp; AI Learning Packages</Label>
            <Textarea
              id="learning-intro"
              value={learningIntroDraft}
              onChange={(event) => setLearningIntroDraft(event.target.value)}
              rows={3}
              className="mt-1.5"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={savingIntro}
              onClick={() => void saveIntro(LEARNING_INTRO_KEY, learningIntroDraft)}
            >
              {savingIntro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save introduction
            </Button>
          </div>

          <div>
            <Label htmlFor="services-intro">Digital Services for Clients</Label>
            <Textarea
              id="services-intro"
              value={servicesIntroDraft}
              onChange={(event) => setServicesIntroDraft(event.target.value)}
              rows={3}
              className="mt-1.5"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={savingIntro}
              onClick={() => void saveIntro(SERVICES_INTRO_KEY, servicesIntroDraft)}
            >
              {savingIntro ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save introduction
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the listings…
          </p>
        ) : (
          <>
            {section("learning_package", "Digital Products & AI Learning Packages")}
            {section("service", "Digital Services for Clients")}
          </>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/digital-solutions" target="_blank" rel="noreferrer">
            Open the public page
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-accent">
          <Link to="/admin/digital-requests">Client requests</Link>
        </Button>
      </div>

      <Dialog
        open={Boolean(target && draft)}
        onOpenChange={(open) => {
          if (busy) return;
          if (!open) {
            setTarget(null);
            setDraft(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {target?.label} · {target?.name}
            </DialogTitle>
            <DialogDescription>
              Key <span className="font-mono">{target?.offeringKey}</span>. Changes appear on the public page and
              are used by new requests and quotations. Existing quotations keep the price recorded on them.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="o-label">Label</Label>
                  <Input
                    id="o-label"
                    value={draft.label}
                    onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="o-sort">Display order</Label>
                  <Input
                    id="o-sort"
                    inputMode="numeric"
                    value={draft.sortOrder}
                    onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value.replace(/[^0-9]/g, "") })}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="o-name">Listing name</Label>
                  <Input
                    id="o-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="o-summary">Short description</Label>
                  <Textarea
                    id="o-summary"
                    value={draft.summary}
                    onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                    rows={2}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="o-description">Full description</Label>
                  <Textarea
                    id="o-description"
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="o-inclusions">Inclusions — one per line</Label>
                  <Textarea
                    id="o-inclusions"
                    value={draft.inclusions}
                    onChange={(event) => setDraft({ ...draft, inclusions: event.target.value })}
                    rows={5}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="o-price">Published price</Label>
                  <Input
                    id="o-price"
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(event) => setDraft({ ...draft, price: event.target.value.replace(/[^0-9.]/g, "") })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="o-promo">Promotional price</Label>
                  <Input
                    id="o-promo"
                    inputMode="decimal"
                    value={draft.promoPrice}
                    onChange={(event) => setDraft({ ...draft, promoPrice: event.target.value.replace(/[^0-9.]/g, "") })}
                    placeholder="Optional"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="o-regular">Regular price</Label>
                  <Input
                    id="o-regular"
                    inputMode="decimal"
                    value={draft.regularPrice}
                    onChange={(event) => setDraft({ ...draft, regularPrice: event.target.value.replace(/[^0-9.]/g, "") })}
                    placeholder="Optional"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="o-fee">Recurring fee per year</Label>
                  <Input
                    id="o-fee"
                    inputMode="decimal"
                    value={draft.annualFee}
                    onChange={(event) => setDraft({ ...draft, annualFee: event.target.value.replace(/[^0-9.]/g, "") })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="o-fee-label">Fee label</Label>
                  <Input
                    id="o-fee-label"
                    value={draft.annualFeeLabel}
                    onChange={(event) => setDraft({ ...draft, annualFeeLabel: event.target.value })}
                    placeholder="Hosting, Domain, Optional hosting"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="o-fee-option">Fee type</Label>
                  <Select
                    value={draft.annualFeeOption}
                    onValueChange={(value) => setDraft({ ...draft, annualFeeOption: value as FeeOption })}
                  >
                    <SelectTrigger id="o-fee-option" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No recurring fee</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                      <SelectItem value="recurring">Billed yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <p className="text-[11px] text-muted-foreground">
                    Only the label written here is published. Never state both hosting and domain unless the
                    listing genuinely includes both.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="o-terms">Payment terms</Label>
                  <Select
                    value={draft.paymentTermsMode}
                    onValueChange={(value) => setDraft({ ...draft, paymentTermsMode: value as PaymentTermsMode })}
                  >
                    <SelectTrigger id="o-terms" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project_50_50">50% on signing / 50% after completion</SelectItem>
                      <SelectItem value="product_default">Product terms</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="o-terms-note">Payment terms note</Label>
                  <Input
                    id="o-terms-note"
                    value={draft.paymentTermsNote}
                    onChange={(event) => setDraft({ ...draft, paymentTermsNote: event.target.value })}
                    placeholder="Used for ebooks and training"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {target && target.maintenanceOptions.length > 0 ? (
                <div className="rounded-lg border border-dashed p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Maintenance alternatives (fixed)
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {target.maintenanceOptions.map((option) => (
                      <li key={option.key}>
                        <span className="font-semibold">{MAINTENANCE_MODE_LABEL[option.key]}:</span>{" "}
                        {option.detail}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Exactly one of these is recorded on a quotation — never both.
                  </p>
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={draft.isActive}
                  onCheckedChange={(value) => setDraft({ ...draft, isActive: value === true })}
                />
                Published on the public page
              </label>

              {error ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTarget(null);
                setDraft(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={busy || !draft}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
