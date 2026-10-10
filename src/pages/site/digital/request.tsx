import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Info,
  Loader2,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useDigitalOfferings } from "@/hooks/use-digital-offerings";
import { RequestAttachmentPicker, useRequestAttachments } from "@/components/digital/request-attachments";
import { supabase } from "@/integrations/supabase/client";
import { formatPeso } from "@/lib/kmd/format";
import { offeringFeeText, type DigitalOffering } from "@/lib/digital/types";

interface SubmitResult {
  status: "CREATED" | "DUPLICATE" | "FAILED";
  requestNumber: string | null;
  reasonText: string;
}

const HOSTING_OPTIONS = [
  { value: "client_provides", label: "Client provides the hosting and domain" },
  { value: "kmd_setup_requested", label: "Hosting setup and management requested" },
  { value: "to_be_discussed", label: "To be discussed" },
];

const MAINTENANCE_PREFERENCES = [
  { value: "none", label: "No maintenance plan" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
  { value: "to_be_discussed", label: "To be discussed" },
];

export default function DigitalRequestPage() {
  const [params] = useSearchParams();
  // A string, not the object: `useSearchParams` may return a new instance on each
  // render, and an object in a dependency list would re-run the prefill endlessly.
  const search = params.toString();
  const { profile } = useAuth();
  const { offerings, learningPackages, services, loading } = useDigitalOfferings();
  const attachments = useRequestAttachments();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [clientName, setClientName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.mobile_number ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [businessName, setBusinessName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [learningGoals, setLearningGoals] = useState("");
  const [productsServices, setProductsServices] = useState("");
  const [requiredFeatures, setRequiredFeatures] = useState("");
  const [preferredDomain, setPreferredDomain] = useState("");
  const [designReferences, setDesignReferences] = useState("");
  const [contentSupplied, setContentSupplied] = useState("");
  const [preferredCompletion, setPreferredCompletion] = useState("");
  const [hostingPreference, setHostingPreference] = useState("to_be_discussed");
  const [maintenancePreference, setMaintenancePreference] = useState("to_be_discussed");
  const [maintenanceChoice, setMaintenanceChoice] = useState<"none" | "co_partner_5_percent" | "client_monthly_50000">("none");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Prefill from the listing that was clicked, once the catalogue is in.
  useEffect(() => {
    if (offerings.length === 0) return;
    const query = new URLSearchParams(search);
    const fromQuery = [
      ...query.getAll("item"),
      ...query.getAll("items").flatMap((value) => value.split(",")),
    ]
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0);

    if (fromQuery.length === 0) return;

    setSelectedKeys((current) => {
      const merged = [...current];
      fromQuery.forEach((key) => {
        if (offerings.some((offering) => offering.offeringKey === key) && !merged.includes(key)) {
          merged.push(key);
        }
      });
      return merged;
    });
  }, [offerings, search]);

  const selected = useMemo(
    () => offerings.filter((offering) => selectedKeys.includes(offering.offeringKey)),
    [offerings, selectedKeys],
  );

  const hasLearning = selected.some((offering) => offering.offeringGroup === "learning_package");
  const hasService = selected.some((offering) => offering.offeringGroup === "service");
  const mlmDashboard = selected.find((offering) =>
    offering.maintenanceOptions.some((option) => option.key === "co_partner_5_percent"),
  );

  const oneTimeTotal = selected.reduce((sum, offering) => sum + offering.price, 0);
  const annualFees = selected.filter((offering) => offering.annualFee !== null && offering.annualFeeOption !== "none");
  const annualTotal = annualFees.reduce((sum, offering) => sum + (offering.annualFee ?? 0), 0);

  const toggle = (offering: DigitalOffering, checked: boolean) => {
    setSelectedKeys((current) =>
      checked
        ? [...current, offering.offeringKey]
        : current.filter((key) => key !== offering.offeringKey),
    );
  };

  const submit = async () => {
    setFormError(null);

    if (selected.length === 0) {
      setFormError("Choose at least one learning package or service.");
      return;
    }
    if (!clientName.trim() || !phone.trim() || !email.trim()) {
      setFormError("Enter the client name, contact number and email address so we can reply.");
      return;
    }
    if (hasLearning && !learningGoals.trim()) {
      setFormError("Tell us your learning goals for the package you selected.");
      return;
    }
    if (hasService && (!businessName.trim() || !clientAddress.trim() || !requiredFeatures.trim())) {
      setFormError("For a website or dashboard, enter the business name, client address and the pages or features you need.");
      return;
    }

    setSending(true);
    const attachmentPaths = await attachments.upload();

    const { data, error } = await supabase.rpc("kmd_client_request_submit", {
      p_payload: {
        clientName: clientName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        businessName: businessName.trim() || null,
        clientAddress: clientAddress.trim() || null,
        learningGoals: learningGoals.trim() || null,
        productsServices: productsServices.trim() || null,
        requiredFeatures: requiredFeatures.trim() || null,
        preferredDomain: preferredDomain.trim() || null,
        designReferences: designReferences.trim() || null,
        contentSupplied: contentSupplied.trim() || null,
        attachmentPaths,
        preferredCompletion: preferredCompletion || null,
        hostingPreference: hasService ? hostingPreference : null,
        maintenancePreference: hasService ? maintenancePreference : null,
        maintenanceChoice: maintenanceChoice === "none" ? null : maintenanceChoice,
        itemKeys: selectedKeys,
      },
    });
    setSending(false);

    if (error) {
      console.error("Could not submit the client request:", error.message);
      setFormError("Your request could not be sent just now. Please try again or call us.");
      return;
    }

    const payload = (data ?? {}) as { status?: string; requestNumber?: string; reasonText?: string };
    const status = payload.status === "CREATED" ? "CREATED" : payload.status === "DUPLICATE" ? "DUPLICATE" : "FAILED";

    setResult({
      status,
      requestNumber: payload.requestNumber ?? null,
      reasonText: payload.reasonText ?? "",
    });
  };

  if (result) {
    const created = result.status === "CREATED";

    return (
      <SiteShell>
        <PageHero
          eyebrow={created ? "Request received" : result.status === "DUPLICATE" ? "Already received" : "Not sent"}
          title={
            created
              ? `Request ${result.requestNumber} is with the KMD team`
              : result.status === "DUPLICATE"
                ? "This request was already received"
                : "We could not record that request"
          }
          intro={result.reasonText}
        />

        <Section>
          <div
            className={
              created
                ? "kmd-panel border-success/40 bg-success/5 p-6"
                : result.status === "DUPLICATE"
                  ? "kmd-panel border-warning/40 bg-warning/5 p-6"
                  : "kmd-panel border-destructive/40 bg-destructive/5 p-6"
            }
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              {created ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : result.status === "DUPLICATE" ? (
                <TriangleAlert className="h-4 w-4 text-[hsl(var(--warning))]" />
              ) : (
                <Info className="h-4 w-4 text-destructive" />
              )}
              {result.requestNumber ? `Reference ${result.requestNumber}` : "Nothing was created"}
            </p>

            <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                This is a request for a quotation. No payment has been taken and no contract exists yet.
              </li>
              <li className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                We review the details you sent and prepare a written quotation with the scope, deliverables,
                prices and dates.
              </li>
              <li className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Nothing proceeds until you confirm the quotation and sign it.
              </li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="brand"
                onClick={() => {
                  setResult(null);
                  setSelectedKeys([]);
                  setLearningGoals("");
                  setRequiredFeatures("");
                }}
              >
                <Send className="h-4 w-4" />
                Send another request
              </Button>
              <Button asChild variant="outline">
                <Link to="/digital-solutions">
                  Back to the listings
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/contact">Contact the team</Link>
              </Button>
            </div>
          </div>
        </Section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Client request form"
        title="Request a package or a project"
        intro="Choose what you need and tell us about the client and the work. We reply with a written quotation. A request never takes a payment and never creates a contract."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="space-y-6">
            <div className="kmd-panel p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck className="h-4 w-4 text-primary" />
                1. What do you need?
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Select one or more listings. Packages are training and ebooks; services are websites and
                dashboards we build for you.
              </p>

              {loading ? (
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading the listings…
                </p>
              ) : (
                <div className="mt-5 space-y-6">
                  <div>
                    <p className="kmd-eyebrow text-accent">Digital Products &amp; AI Learning Packages</p>
                    <div className="mt-3 space-y-2">
                      {learningPackages.map((offering) => (
                        <OfferingChoice
                          key={offering.id}
                          offering={offering}
                          checked={selectedKeys.includes(offering.offeringKey)}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="kmd-eyebrow text-accent">Digital Services for Clients</p>
                    <div className="mt-3 space-y-2">
                      {services.map((offering) => (
                        <OfferingChoice
                          key={offering.id}
                          offering={offering}
                          checked={selectedKeys.includes(offering.offeringKey)}
                          onToggle={toggle}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="kmd-panel p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" />
                2. Client and learning details
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="client-name">Client or authorized requester</Label>
                  <Input
                    id="client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Juan Dela Cruz"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="client-phone">Contact number</Label>
                  <Input
                    id="client-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="0917 000 0000"
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="client-email">Email address</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="learning-goals">
                    Learning goals {hasLearning ? "" : "(for learning packages)"}
                  </Label>
                  <Textarea
                    id="learning-goals"
                    value={learningGoals}
                    onChange={(event) => setLearningGoals(event.target.value)}
                    rows={3}
                    placeholder="What do you want to be able to do after the training or the ebook?"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {hasService ? (
              <div className="kmd-panel p-6">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MonitorSmartphone className="h-4 w-4 text-primary" />
                  3. Business and project details
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Needed for a website, e-commerce store or dashboard project.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="business-name">Business name</Label>
                    <Input
                      id="business-name"
                      value={businessName}
                      onChange={(event) => setBusinessName(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="client-address">Client address</Label>
                    <Input
                      id="client-address"
                      value={clientAddress}
                      onChange={(event) => setClientAddress(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="products-services">Products or services offered</Label>
                    <Textarea
                      id="products-services"
                      value={productsServices}
                      onChange={(event) => setProductsServices(event.target.value)}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="required-features">
                      Required pages, features, dashboard functions or project description
                    </Label>
                    <Textarea
                      id="required-features"
                      value={requiredFeatures}
                      onChange={(event) => setRequiredFeatures(event.target.value)}
                      rows={4}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferred-domain">Preferred website domain (www)</Label>
                    <Input
                      id="preferred-domain"
                      value={preferredDomain}
                      onChange={(event) => setPreferredDomain(event.target.value)}
                      placeholder="www.example.com"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preferred-completion">Preferred completion date</Label>
                    <Input
                      id="preferred-completion"
                      type="date"
                      value={preferredCompletion}
                      onChange={(event) => setPreferredCompletion(event.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="design-references">Design preferences or reference websites</Label>
                    <Textarea
                      id="design-references"
                      value={designReferences}
                      onChange={(event) => setDesignReferences(event.target.value)}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="content-supplied">Content, graphics or photos you will supply</Label>
                    <Textarea
                      id="content-supplied"
                      value={contentSupplied}
                      onChange={(event) => setContentSupplied(event.target.value)}
                      rows={2}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="hosting-preference">Hosting and domain</Label>
                    <Select value={hostingPreference} onValueChange={setHostingPreference}>
                      <SelectTrigger id="hosting-preference" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOSTING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="maintenance-preference">Maintenance plan</Label>
                    <Select value={maintenancePreference} onValueChange={setMaintenancePreference}>
                      <SelectTrigger id="maintenance-preference" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MAINTENANCE_PREFERENCES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {mlmDashboard ? (
                    <div className="sm:col-span-2 rounded-lg border border-dashed p-4">
                      <p className="text-xs font-semibold">MLM dashboard maintenance — choose one</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        These are alternatives recorded on the quotation, never both. The agreed basis and the
                        qualifying entry-pack encoding rules are written into the quotation before any 5% is
                        applied.
                      </p>
                      <div className="mt-3 space-y-2">
                        {mlmDashboard.maintenanceOptions.map((option) => (
                          <label key={option.key} className="flex items-start gap-2 text-xs">
                            <input
                              type="radio"
                              name="mlm-maintenance"
                              className="mt-0.5"
                              checked={maintenanceChoice === option.key}
                              onChange={() => setMaintenanceChoice(option.key)}
                            />
                            <span>
                              <span className="font-semibold">{option.label}:</span> {option.detail}
                            </span>
                          </label>
                        ))}
                        <label className="flex items-start gap-2 text-xs">
                          <input
                            type="radio"
                            name="mlm-maintenance"
                            className="mt-0.5"
                            checked={maintenanceChoice === "none"}
                            onChange={() => setMaintenanceChoice("none")}
                          />
                          <span>Decide later with the quotation.</span>
                        </label>
                      </div>
                    </div>
                  ) : null}

                  <div className="sm:col-span-2">
                    <Label>Content, logo and photos</Label>
                    <div className="mt-1.5">
                      <RequestAttachmentPicker state={attachments} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Your selection</p>

              {selected.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Nothing chosen yet. Pick a package or service and the summary builds itself.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {selected.map((offering) => (
                    <li key={offering.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <p className="flex items-start gap-2 text-xs font-semibold">
                        {offering.offeringGroup === "learning_package" ? (
                          <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : (
                          <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                        <span>
                          <span className="text-muted-foreground">{offering.label} · </span>
                          {offering.name}
                        </span>
                      </p>
                      <p className="mt-1 pl-5 text-xs tabular-nums">{formatPeso(offering.price)}</p>
                      {offering.summary ? (
                        <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{offering.summary}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <dl className="mt-4 space-y-2 border-t pt-4 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Estimated project price</dt>
                  <dd className="font-semibold tabular-nums">{formatPeso(oneTimeTotal)}</dd>
                </div>
                {annualFees.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-muted-foreground">Yearly fees, billed separately</dt>
                      <dd className="font-semibold tabular-nums">{formatPeso(annualTotal)}/year</dd>
                    </div>
                    <ul className="space-y-1">
                      {annualFees.map((offering) => (
                        <li key={offering.id} className="text-[11px] text-muted-foreground">
                          {offeringFeeText(offering)} — {offering.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {hasService ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Project payment terms</dt>
                    <dd className="text-right font-semibold">
                      50% on signing, 50% after completion
                    </dd>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Payment terms</dt>
                    <dd className="text-right font-semibold">Set on your quotation</dd>
                  </div>
                )}
              </dl>

              <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed p-3 text-[11px] leading-relaxed text-muted-foreground">
                <FileText className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                These are the published prices. The final figures, scope and dates are confirmed in the
                written quotation, and yearly fees are shown separately unless the quotation states they are
                included.
              </p>
            </div>

            <div className="kmd-panel p-5">
              {formError ? (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                  {formError}
                </p>
              ) : null}

              <Button
                type="button"
                variant="brand"
                size="lg"
                className="w-full"
                disabled={sending || selected.length === 0}
                onClick={() => void submit()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending…" : "Send my request"}
              </Button>

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                A request only. No payment is taken, no order is placed and no contract exists until a
                quotation is agreed and signed.
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </SiteShell>
  );
}

function OfferingChoice({
  offering,
  checked,
  onToggle,
}: {
  offering: DigitalOffering;
  checked: boolean;
  onToggle: (offering: DigitalOffering, checked: boolean) => void;
}) {
  const fee = offeringFeeText(offering);

  return (
    <label
      className={
        checked
          ? "flex cursor-pointer items-start gap-3 rounded-lg border border-primary/50 bg-primary/5 p-3"
          : "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
      }
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onToggle(offering, value === true)}
        className="mt-0.5"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">
          <span className="text-muted-foreground">{offering.label} · </span>
          {offering.name}
        </span>
        {offering.summary ? (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{offering.summary}</span>
        ) : null}
        <span className="mt-1 block text-xs font-semibold tabular-nums">{formatPeso(offering.price)}</span>
        {fee ? <span className="block text-[11px] text-muted-foreground">+ {fee}</span> : null}
      </span>
    </label>
  );
}
