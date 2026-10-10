import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Download,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Plus,
  Printer,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/kmd/invoke";
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
import { QuotationPreview } from "@/components/digital/quotation-preview";
import { printQuotation } from "@/lib/digital/print";
import { formatPeso, toNumber } from "@/lib/kmd/format";
import {
  FEE_KIND_LABEL,
  MAINTENANCE_MODE_LABEL,
  QUOTATION_STATUS_LABEL,
  SERVICES_CHECKLIST,
  mapOffering,
  mapQuotation,
  mapRequest,
  type ClientRequest,
  type DigitalOffering,
  type MaintenanceMode,
  type PaymentTermsMode,
  type Quotation,
  type QuotationFee,
  type QuotationLine,
  type QuotationStatus,
} from "@/lib/digital/types";

/**
 * The Word and PDF renderers are large, and nothing on the public site needs
 * them, so they are fetched only when an administrator asks for a download.
 * The printed copy needs no extra library.
 */
async function buildDocx(quotation: Quotation) {
  const { downloadQuotationDocx } = await import("@/lib/digital/docx");
  await downloadQuotationDocx(quotation);
}

async function buildPdf(quotation: Quotation) {
  const { downloadQuotationPdf } = await import("@/lib/digital/pdf");
  await downloadQuotationPdf(quotation);
}

interface DraftState {
  quotationDate: string;
  validUntil: string;
  targetCompletion: string;
  clientName: string;
  clientAddress: string;
  contactNumber: string;
  email: string;
  businessName: string;
  items: QuotationLine[];
  additionalWork: QuotationLine[];
  servicesRequested: string[];
  projectRequirements: string;
  scope: string;
  deliverables: string;
  discount: string;
  taxAmount: string;
  optionalFees: QuotationFee[];
  maintenanceMode: MaintenanceMode;
  maintenanceNote: string;
  paymentTermsMode: PaymentTermsMode;
  paymentTermsNote: string;
  terms: string;
  preparedBy: string;
  status: QuotationStatus;
}

const today = () => new Date().toISOString().slice(0, 10);

function blankDraft(): DraftState {
  return {
    quotationDate: today(),
    validUntil: "",
    targetCompletion: "",
    clientName: "",
    clientAddress: "",
    contactNumber: "",
    email: "",
    businessName: "",
    items: [{ description: "", qty: 1, amount: 0 }],
    additionalWork: [],
    servicesRequested: [],
    projectRequirements: "",
    scope: "",
    deliverables: "",
    discount: "0",
    taxAmount: "0",
    optionalFees: [],
    maintenanceMode: "none",
    maintenanceNote: "",
    paymentTermsMode: "product_default",
    paymentTermsNote: "",
    terms: "",
    preparedBy: "Dan Taoc",
    status: "draft",
  };
}

export default function AdminQuotationDetail() {
  const { quotationId = "new" } = useParams();
  const [params] = useSearchParams();
  // The raw string keeps the loader stable: the object form can change identity
  // on every render, which would reload the quotation in a loop.
  const requestParam = params.get("request");
  const navigate = useNavigate();

  const [draft, setDraft] = useState<DraftState>(blankDraft);
  const [saved, setSaved] = useState<Quotation | null>(null);
  const [request, setRequest] = useState<ClientRequest | null>(null);
  const [offerings, setOfferings] = useState<DigitalOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const offeringsResult = await supabase.from("digital_offerings").select("*").order("sort_order");
    const catalogue = ((offeringsResult.data ?? []) as Array<Record<string, unknown>>).map(mapOffering);
    setOfferings(catalogue);

    if (quotationId === "new") {
      const requestId = requestParam;
      if (!requestId) {
        setDraft(blankDraft());
        setSaved(null);
        setRequest(null);
        setLoading(false);
        return;
      }

      const { data, error: requestError } = await supabase
        .from("client_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (requestError || !data) {
        console.error("Could not load the client request:", requestError?.message);
        setError("That client request could not be loaded.");
        setLoading(false);
        return;
      }

      const loaded = mapRequest(data as Record<string, unknown>);
      setRequest(loaded);

      // Prefill from what the client actually selected: the item snapshot taken
      // at submission time is the price basis for the quotation.
      const fees: QuotationFee[] = [];
      loaded.items.forEach((item) => {
        if (item.annualFee !== null && item.annualFeeLabel && item.annualFeeOption !== "none") {
          const kind: QuotationFee["kind"] = item.annualFeeLabel.toLowerCase().includes("domain")
            ? item.annualFeeLabel.toLowerCase().includes("hosting")
              ? "other"
              : "domain"
            : "hosting";
          if (fees.some((fee) => fee.kind === kind)) return;
          fees.push({
            kind,
            description: item.annualFeeLabel,
            amount: item.annualFee,
            percent: null,
            per: "year",
            includedInTotal: false,
          });
        }
      });

      if (loaded.maintenanceChoice === "client_monthly_50000") {
        fees.push({
          kind: "maintenance",
          description: "Client maintenance — ₱50,000 per month",
          amount: 50000,
          percent: null,
          per: "month",
          includedInTotal: false,
        });
      } else if (loaded.maintenanceChoice === "co_partner_5_percent") {
        fees.push({
          kind: "maintenance",
          description: "Co-partner arrangement — 5% of the entry-pack amount per qualifying entry-pack encoding",
          amount: null,
          percent: 5,
          per: "entry_pack_encoding",
          includedInTotal: false,
        });
      }

      const hasService = loaded.items.some((item) => item.group === "service");
      const inclusions = loaded.items.flatMap((item) => item.inclusions.map((value) => `${item.label}: ${value}`));

      setDraft({
        quotationDate: today(),
        validUntil: "",
        targetCompletion: loaded.preferredCompletion ?? "",
        clientName: loaded.clientName,
        clientAddress: loaded.clientAddress ?? "",
        contactNumber: loaded.phone,
        email: loaded.email,
        businessName: loaded.businessName ?? "",
        items: loaded.items.map((item) => ({
          // A promotional listing carries both figures onto the quotation, so the
          // client sees what the regular price is and what the promotion is.
          description:
            item.regularPrice !== null && item.regularPrice > item.price
              ? `${item.label} — ${item.name} (promotional price ${formatPeso(item.price)}; regular price ${formatPeso(item.regularPrice)})`
              : `${item.label} — ${item.name}`,
          qty: 1,
          amount: item.price,
        })),
        additionalWork: [],
        servicesRequested: loaded.items.map((item) => item.offeringKey),
        projectRequirements: loaded.requiredFeatures ?? "",
        scope: inclusions.join("\n"),
        deliverables: "",
        discount: "0",
        taxAmount: "0",
        optionalFees: fees,
        maintenanceMode: loaded.maintenanceChoice ?? "none",
        maintenanceNote: "",
        paymentTermsMode: hasService ? "project_50_50" : "product_default",
        paymentTermsNote: "",
        terms: "",
        preparedBy: "Dan Taoc",
        status: "draft",
      });
      setSaved(null);
      setLoading(false);
      return;
    }

    const { data, error: quotationError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", quotationId)
      .maybeSingle();

    if (quotationError || !data) {
      console.error("Could not load the quotation:", quotationError?.message);
      setError("That quotation could not be loaded.");
      setLoading(false);
      return;
    }

    const quotation = mapQuotation(data as Record<string, unknown>);
    setSaved(quotation);
    setDraft({
      quotationDate: quotation.quotationDate,
      validUntil: quotation.validUntil ?? "",
      targetCompletion: quotation.targetCompletion ?? "",
      clientName: quotation.clientName,
      clientAddress: quotation.clientAddress ?? "",
      contactNumber: quotation.contactNumber ?? "",
      email: quotation.email ?? "",
      businessName: quotation.businessName ?? "",
      items: quotation.items.length > 0 ? quotation.items : [{ description: "", qty: 1, amount: 0 }],
      additionalWork: quotation.additionalWork,
      servicesRequested: quotation.servicesRequested,
      projectRequirements: quotation.projectRequirements ?? "",
      scope: quotation.scope ?? "",
      deliverables: quotation.deliverables ?? "",
      discount: String(quotation.discount),
      taxAmount: String(quotation.taxAmount),
      optionalFees: quotation.optionalFees,
      maintenanceMode: quotation.maintenanceMode,
      maintenanceNote: quotation.maintenanceNote ?? "",
      paymentTermsMode: quotation.paymentTermsMode,
      paymentTermsNote: quotation.paymentTermsNote ?? "",
      terms: quotation.terms ?? "",
      preparedBy: quotation.preparedBy,
      status: quotation.status,
    });

    if (quotation.requestId) {
      const { data: requestRow } = await supabase
        .from("client_requests")
        .select("*")
        .eq("id", quotation.requestId)
        .maybeSingle();
      setRequest(requestRow ? mapRequest(requestRow as Record<string, unknown>) : null);
    } else {
      setRequest(null);
    }

    setLoading(false);
  }, [quotationId, requestParam]);

  useEffect(() => {
    void load();
  }, [load]);

  /* The same arithmetic the server applies, shown live so the administrator sees
     the totals before saving. The saved record remains the authority. */
  const totals = useMemo(() => {
    const subtotal = [...draft.items, ...draft.additionalWork].reduce(
      (sum, line) => sum + toNumber(line.amount),
      0,
    );
    const discount = toNumber(draft.discount);
    const tax = toNumber(draft.taxAmount);
    const included = draft.optionalFees
      .filter((fee) => fee.includedInTotal && !(fee.percent && fee.percent > 0))
      .reduce((sum, fee) => sum + toNumber(fee.amount), 0);
    const separateRows = draft.optionalFees.filter(
      (fee) => !fee.includedInTotal && !(fee.percent && fee.percent > 0),
    );
    const separate = separateRows.reduce((sum, fee) => sum + toNumber(fee.amount), 0);
    const total = Math.max(subtotal + included - discount + tax, 0);
    const project = draft.paymentTermsMode === "project_50_50";

    return {
      subtotal,
      included,
      separate,
      total,
      deposit: project ? Math.round((total / 2) * 100) / 100 : null,
      balance: project ? total - Math.round((total / 2) * 100) / 100 : null,
    };
  }, [draft]);

  const duplicateKind = useMemo(() => {
    const seen = new Set<string>();
    for (const fee of draft.optionalFees) {
      const kind = fee.kind;
      if (kind === "other") continue;
      if (seen.has(kind)) return FEE_KIND_LABEL[kind];
      seen.add(kind);
    }
    return null;
  }, [draft.optionalFees]);

  const serviceKeys = useMemo(() => new Set(offerings.map((offering) => offering.offeringKey)), [offerings]);

  const save = async () => {
    setError(null);

    if (!draft.clientName.trim()) {
      setError("Enter the client name exactly as it should appear on the quotation.");
      return;
    }
    if (draft.items.every((line) => line.description.trim().length === 0)) {
      setError("Add at least one quoted line for the service or deliverable.");
      return;
    }
    if (duplicateKind) {
      setError(`Only one ${duplicateKind} charge can be recorded, so it is never billed twice.`);
      return;
    }

    setBusy(true);
    const outcome = await invokeFunction<{ result?: { status?: string; reasonText?: string; quotation?: Record<string, unknown> } }>(
      "admin-actions",
      {
        action: "save_quotation",
        payload: {
          quotationId: quotationId === "new" ? null : quotationId,
          requestId: request?.id ?? saved?.requestId ?? null,
          quotationDate: draft.quotationDate || null,
          validUntil: draft.validUntil || null,
          targetCompletion: draft.targetCompletion || null,
          clientName: draft.clientName.trim(),
          clientAddress: draft.clientAddress.trim() || null,
          contactNumber: draft.contactNumber.trim() || null,
          email: draft.email.trim() || null,
          businessName: draft.businessName.trim() || null,
          items: draft.items.filter((line) => line.description.trim().length > 0),
          additionalWork: draft.additionalWork.filter((line) => line.description.trim().length > 0),
          servicesRequested: draft.servicesRequested,
          projectRequirements: draft.projectRequirements.trim() || null,
          scope: draft.scope.trim() || null,
          deliverables: draft.deliverables.trim() || null,
          discount: toNumber(draft.discount),
          taxAmount: toNumber(draft.taxAmount),
          optionalFees: draft.optionalFees,
          maintenanceMode: draft.maintenanceMode,
          maintenanceNote: draft.maintenanceNote.trim() || null,
          paymentTermsMode: draft.paymentTermsMode,
          paymentTermsNote: draft.paymentTermsNote.trim() || null,
          terms: draft.terms.trim() || null,
          preparedBy: draft.preparedBy.trim() || "Dan Taoc",
          status: draft.status,
        },
      },
    );
    setBusy(false);

    if (!outcome.ok) {
      setError(outcome.error ?? "The quotation could not be saved.");
      return;
    }

    const result = outcome.data?.result;
    if (result?.status !== "SAVED" || !result.quotation) {
      setError(result?.reasonText ?? "The quotation was refused.");
      return;
    }

    const quotation = mapQuotation(result.quotation);
    setSaved(quotation);
    toast.success(`Quotation ${quotation.quotationNumber} saved`, {
      description: `Contract price ${formatPeso(quotation.totalContractPrice)}${
        quotation.separateFeesTotal > 0 ? `, ${formatPeso(quotation.separateFeesTotal)} billed separately` : ""
      }.`,
    });

    if (quotationId === "new") {
      navigate(`/admin/quotations/${quotation.id}`, { replace: true });
    }
  };

  const updateLine = (key: "items" | "additionalWork", index: number, patch: Partial<QuotationLine>) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((line, position) => (position === index ? { ...line, ...patch } : line)),
    }));
  };

  const updateFee = (index: number, patch: Partial<QuotationFee>) => {
    setDraft((current) => ({
      ...current,
      optionalFees: current.optionalFees.map((fee, position) =>
        position === index ? { ...fee, ...patch } : fee,
      ),
    }));
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading the quotation…
      </p>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="text-accent">
          <Link to="/admin/quotations">
            <ArrowLeft className="h-3.5 w-3.5" />
            All quotations
          </Link>
        </Button>
      </div>

      <PageHeader
        title={saved ? `Quotation ${saved.quotationNumber}` : "New quotation"}
        description={
          saved
            ? "Edit the scope, prices and fees, then save. The preview, Word file, PDF and printed copy all render this saved record."
            : request
              ? `Prefilled from request ${request.requestNumber}. Nothing is saved until you save it.`
              : "Start a blank quotation, or open a client request and choose Prepare quotation."
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!saved}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              variant="outline"
              disabled={!saved}
              onClick={() => saved && void buildDocx(saved)}
            >
              <FileDown className="h-4 w-4" />
              Word (.docx)
            </Button>
            <Button variant="outline" disabled={!saved} onClick={() => saved && void buildPdf(saved)}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" disabled={!saved} onClick={() => saved && printQuotation(saved)}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save quotation
            </Button>
          </>
        }
      />

      {!saved ? (
        <p className="mt-4 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          Preview, Word, PDF and Print become available once the quotation has been saved, because they render
          the saved record rather than the form.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {request ? (
        <div className="kmd-panel mt-4 p-4">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <BadgeCheck className="h-3.5 w-3.5 text-primary" />
            From request <span className="font-mono font-semibold">{request.requestNumber}</span>
            <span className="text-muted-foreground">
              · {request.clientName} · {request.email} · {request.phone}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Quotation reference</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="quotation-date">Quotation date</Label>
                <Input
                  id="quotation-date"
                  type="date"
                  value={draft.quotationDate}
                  onChange={(event) => setDraft({ ...draft, quotationDate: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="valid-until">Valid until</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={draft.validUntil}
                  onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="target-completion">Target completion</Label>
                <Input
                  id="target-completion"
                  type="date"
                  value={draft.targetCompletion}
                  onChange={(event) => setDraft({ ...draft, targetCompletion: event.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="quotation-status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setDraft({ ...draft, status: value as QuotationStatus })}
                >
                  <SelectTrigger id="quotation-status" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(QUOTATION_STATUS_LABEL) as QuotationStatus[]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {QUOTATION_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="prepared-by">Prepared by</Label>
                <Input
                  id="prepared-by"
                  value={draft.preparedBy}
                  onChange={(event) => setDraft({ ...draft, preparedBy: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-end">
                {saved ? (
                  <StatusBadge label={QUOTATION_STATUS_LABEL[saved.status]} tone="info" />
                ) : (
                  <span className="text-[11px] text-muted-foreground">Not saved yet</span>
                )}
              </div>
            </div>
          </section>

          <section className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Client details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-client">Client or authorized requester</Label>
                <Input
                  id="q-client"
                  value={draft.clientName}
                  onChange={(event) => setDraft({ ...draft, clientName: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="q-business">Business name</Label>
                <Input
                  id="q-business"
                  value={draft.businessName}
                  onChange={(event) => setDraft({ ...draft, businessName: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="q-contact">Contact number</Label>
                <Input
                  id="q-contact"
                  value={draft.contactNumber}
                  onChange={(event) => setDraft({ ...draft, contactNumber: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="q-email">Email</Label>
                <Input
                  id="q-email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="q-address">Client address</Label>
                <Input
                  id="q-address"
                  value={draft.clientAddress}
                  onChange={(event) => setDraft({ ...draft, clientAddress: event.target.value })}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          <section className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Services requested</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The checklist printed on the quotation. Tick what the client asked for.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SERVICES_CHECKLIST.map((option) => {
                const available = option.offeringKeys.filter((key) => serviceKeys.has(key));
                const checked =
                  available.length > 0 && available.every((key) => draft.servicesRequested.includes(key));
                return (
                  <label
                    key={option.label}
                    className={
                      available.length === 0
                        ? "flex items-center gap-2 text-xs text-muted-foreground"
                        : "flex items-center gap-2 text-xs"
                    }
                  >
                    <Checkbox
                      checked={checked}
                      disabled={available.length === 0}
                      onCheckedChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          servicesRequested:
                            value === true
                              ? [...new Set([...current.servicesRequested, ...available])]
                              : current.servicesRequested.filter((key) => !available.includes(key)),
                        }))
                      }
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-requirements">Business and project requirements</Label>
                <Textarea
                  id="q-requirements"
                  value={draft.projectRequirements}
                  onChange={(event) => setDraft({ ...draft, projectRequirements: event.target.value })}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="q-scope">Agreed scope</Label>
                <Textarea
                  id="q-scope"
                  value={draft.scope}
                  onChange={(event) => setDraft({ ...draft, scope: event.target.value })}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="q-deliverables">Deliverables</Label>
                <Textarea
                  id="q-deliverables"
                  value={draft.deliverables}
                  onChange={(event) => setDraft({ ...draft, deliverables: event.target.value })}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          <section className="kmd-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Project quotation</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft({ ...draft, items: [...draft.items, { description: "", qty: 1, amount: 0 }] })}
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {draft.items.map((line, index) => (
                <LineRow
                  key={`item-${index}`}
                  line={line}
                  onChange={(patch) => updateLine("items", index, patch)}
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      items: draft.items.filter((_, position) => position !== index),
                    })
                  }
                />
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Additional agreed work
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({ ...draft, additionalWork: [...draft.additionalWork, { description: "", qty: 1, amount: 0 }] })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {draft.additionalWork.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nothing added. Work outside the agreed scope is quoted here or on a separate quotation.
                </p>
              ) : (
                draft.additionalWork.map((line, index) => (
                  <LineRow
                    key={`extra-${index}`}
                    line={line}
                    onChange={(patch) => updateLine("additionalWork", index, patch)}
                    onRemove={() =>
                      setDraft({
                        ...draft,
                        additionalWork: draft.additionalWork.filter((_, position) => position !== index),
                      })
                    }
                  />
                ))
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="q-discount">Discount if applicable</Label>
                <Input
                  id="q-discount"
                  inputMode="decimal"
                  value={draft.discount}
                  onChange={(event) => setDraft({ ...draft, discount: event.target.value.replace(/[^0-9.]/g, "") })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="q-tax">Applicable taxes if any</Label>
                <Input
                  id="q-tax"
                  inputMode="decimal"
                  value={draft.taxAmount}
                  onChange={(event) => setDraft({ ...draft, taxAmount: event.target.value.replace(/[^0-9.]/g, "") })}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          <section className="kmd-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Optional maintenance, domain and hosting</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each charge appears once. Include it in the contract price or leave it billed separately —
                  either way it is counted once, never twice.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    optionalFees: [
                      ...draft.optionalFees,
                      { kind: "other", description: "", amount: 0, percent: null, per: "year", includedInTotal: false },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add charge
              </Button>
            </div>

            {duplicateKind ? (
              <p className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[11px] font-medium">
                <TriangleAlert className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
                Two {duplicateKind.toLowerCase()} charges are listed. Keep one.
              </p>
            ) : null}

            <div className="mt-4 space-y-3">
              {draft.optionalFees.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No recurring charge on this quotation.</p>
              ) : (
                draft.optionalFees.map((fee, index) => (
                  <div key={`fee-${index}`} className="rounded-lg border p-3">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-3">
                        <Label>Charge</Label>
                        <Select
                          value={fee.kind}
                          onValueChange={(value) => updateFee(index, { kind: value as QuotationFee["kind"] })}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(FEE_KIND_LABEL) as QuotationFee["kind"][]).map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {FEE_KIND_LABEL[kind]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-5">
                        <Label>Description as billed</Label>
                        <Input
                          value={fee.description}
                          onChange={(event) => updateFee(index, { description: event.target.value })}
                          placeholder="Hosting, Domain, Hosting and domain combined"
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Amount</Label>
                        <Input
                          inputMode="decimal"
                          value={fee.amount === null ? "" : String(fee.amount)}
                          onChange={(event) =>
                            updateFee(index, {
                              amount: event.target.value.replace(/[^0-9.]/g, "") === ""
                                ? null
                                : toNumber(event.target.value),
                            })
                          }
                          className="mt-1.5"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label>Per</Label>
                        <Select
                          value={fee.per ?? "year"}
                          onValueChange={(value) => updateFee(index, { per: value })}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="year">Year</SelectItem>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="quarter">Quarter</SelectItem>
                            <SelectItem value="entry_pack_encoding">Qualifying encoding</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={fee.includedInTotal}
                          onCheckedChange={(value) => updateFee(index, { includedInTotal: value === true })}
                        />
                        Included in the total contract price
                      </label>
                      <span className="text-muted-foreground">
                        {fee.includedInTotal
                          ? "Added to the contract price."
                          : "Shown as billed separately."}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            optionalFees: draft.optionalFees.filter((_, position) => position !== index),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Maintenance arrangement and payment terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="m-mode">Maintenance arrangement</Label>
                <Select
                  value={draft.maintenanceMode}
                  onValueChange={(value) => setDraft({ ...draft, maintenanceMode: value as MaintenanceMode })}
                >
                  <SelectTrigger id="m-mode" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MAINTENANCE_MODE_LABEL) as MaintenanceMode[]).map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {MAINTENANCE_MODE_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="p-mode">Payment terms</Label>
                <Select
                  value={draft.paymentTermsMode}
                  onValueChange={(value) => setDraft({ ...draft, paymentTermsMode: value as PaymentTermsMode })}
                >
                  <SelectTrigger id="p-mode" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="project_50_50">50% on signing / 50% after completion</SelectItem>
                    <SelectItem value="product_default">Product terms</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Project terms are for websites and dashboards. Ebooks and training use product terms.
                </p>
              </div>
              <div>
                <Label htmlFor="m-note">
                  Agreed basis and qualifying encodings {draft.maintenanceMode === "co_partner_5_percent" ? "(required before issuing)" : ""}
                </Label>
                <Textarea
                  id="m-note"
                  value={draft.maintenanceNote}
                  onChange={(event) => setDraft({ ...draft, maintenanceNote: event.target.value })}
                  rows={3}
                  className="mt-1.5"
                  placeholder="Record what counts as a qualifying entry-pack encoding before any 5% is applied."
                />
              </div>
              <div>
                <Label htmlFor="p-note">Payment terms note</Label>
                <Textarea
                  id="p-note"
                  value={draft.paymentTermsNote}
                  onChange={(event) => setDraft({ ...draft, paymentTermsNote: event.target.value })}
                  rows={3}
                  className="mt-1.5"
                  placeholder="For ebook and training purchases, state the applicable payment terms here."
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="q-terms">Additional terms</Label>
                <Textarea
                  id="q-terms"
                  value={draft.terms}
                  onChange={(event) => setDraft({ ...draft, terms: event.target.value })}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="kmd-panel p-5">
            <p className="kmd-eyebrow text-accent">Calculated totals</p>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Subtotal" value={formatPeso(totals.subtotal)} />
              {totals.included > 0 ? (
                <Row label="Recurring charges included" value={formatPeso(totals.included)} />
              ) : null}
              <Row label="Discount" value={`- ${formatPeso(toNumber(draft.discount))}`} />
              <Row label="Taxes" value={formatPeso(toNumber(draft.taxAmount))} />
              <div className="border-t pt-2">
                <Row label="TOTAL CONTRACT PRICE" value={formatPeso(totals.total)} strong />
              </div>
              {totals.deposit !== null ? (
                <>
                  <Row label="50% on signing" value={formatPeso(totals.deposit)} />
                  <Row label="50% after completion" value={formatPeso(totals.balance ?? 0)} />
                </>
              ) : null}
              {totals.separate > 0 ? (
                <div className="border-t pt-2">
                  <Row label="Billed separately" value={formatPeso(totals.separate)} />
                </div>
              ) : null}
            </dl>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Shown for review. The server recalculates every figure from the saved line items on save, and the
              quotation document renders that saved result.
            </p>
          </div>

          <div className="kmd-panel p-5">
            <p className="kmd-eyebrow text-accent">Outputs</p>
            <div className="mt-3 grid gap-2">
              <Button variant="outline" size="sm" disabled={!saved} onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5" />
                Preview document
              </Button>
              <Button variant="outline" size="sm" disabled={!saved} onClick={() => saved && void buildDocx(saved)}>
                <FileDown className="h-3.5 w-3.5" />
                Download Word (.docx)
              </Button>
              <Button variant="outline" size="sm" disabled={!saved} onClick={() => saved && void buildPdf(saved)}>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" disabled={!saved} onClick={() => saved && printQuotation(saved)}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
            </div>
            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
              <FileText className="mt-0.5 h-3 w-3 shrink-0" />
              The Word file is a real, editable document using the KMD Digital Solutions template: logo, quotation
              reference, checklist, pricing table, recurring fees, payment terms and the acceptance block with
              signature and date spaces.
            </p>
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quotation {saved?.quotationNumber}</DialogTitle>
          </DialogHeader>
          {saved ? <QuotationPreview quotation={saved} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "text-sm font-bold tabular-nums" : "tabular-nums"}>{value}</dd>
    </div>
  );
}

function LineRow({
  line,
  onChange,
  onRemove,
}: {
  line: QuotationLine;
  onChange: (patch: Partial<QuotationLine>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
      <div className="sm:col-span-7">
        <Label>Service or deliverable</Label>
        <Textarea
          value={line.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={2}
          className="mt-1.5"
        />
      </div>
      <div className="sm:col-span-1">
        <Label>Qty</Label>
        <Input
          inputMode="numeric"
          value={String(line.qty)}
          onChange={(event) => onChange({ qty: toNumber(event.target.value.replace(/[^0-9]/g, ""), 1) })}
          className="mt-1.5"
        />
      </div>
      <div className="sm:col-span-3">
        <Label>Amount PHP</Label>
        <Input
          inputMode="decimal"
          value={String(line.amount)}
          onChange={(event) => onChange({ amount: toNumber(event.target.value.replace(/[^0-9.]/g, "")) })}
          className="mt-1.5"
        />
      </div>
      <div className="flex items-end sm:col-span-1">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
