import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  MonitorSmartphone,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { PriceTag } from "@/components/site/price-tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDigitalOfferings } from "@/hooks/use-digital-offerings";
import { useSiteText } from "@/contexts/store-context";
import { formatPeso } from "@/lib/kmd/format";
import type { DigitalOffering } from "@/lib/digital/types";

const LEARNING_INTRO_FALLBACK =
  "Discover practical ways to turn your ideas into digital projects";
const SERVICES_INTRO_FALLBACK = "Bring your business ideas to life with KMD Digital Solutions";

/** Exact wording for the recurring charge: only what the listing itself states. */
function annualFeeText(offering: DigitalOffering): string | null {
  if (offering.annualFee === null || offering.annualFeeOption === "none" || !offering.annualFeeLabel) {
    return null;
  }
  return `${offering.annualFeeLabel}: ${formatPeso(offering.annualFee)}/year`;
}

function OfferingCard({ offering, index }: { offering: DigitalOffering; index: number }) {
  const feeText = annualFeeText(offering);
  const requestHref = `/digital-solutions/request?item=${encodeURIComponent(offering.offeringKey)}`;

  return (
    <article className="kmd-panel flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/40 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            {offering.offeringGroup === "learning_package" ? (
              <GraduationCap className="h-5 w-5" />
            ) : (
              <MonitorSmartphone className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="kmd-eyebrow text-accent">{offering.label}</p>
            <h3 className="mt-1 text-sm font-semibold leading-snug">{offering.name}</h3>
          </div>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">#{index + 1}</span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {offering.summary ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{offering.summary}</p>
        ) : null}

        {offering.description ? (
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{offering.description}</p>
        ) : null}

        {offering.inclusions.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {offering.inclusions.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {offering.maintenanceOptions.length > 0 ? (
          <div className="mt-4 rounded-lg border border-dashed p-3">
            <p className="kmd-eyebrow text-muted-foreground">Maintenance — choose one, never both</p>
            <ul className="mt-2 space-y-1.5">
              {offering.maintenanceOptions.map((option) => (
                <li key={option.key} className="text-[11px] leading-relaxed">
                  <span className="font-semibold">{option.label}:</span> {option.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-auto pt-5">
          {offering.promoPrice !== null || offering.regularPrice !== null ? (
            <PriceTag
              regularPrice={offering.regularPrice}
              promoPrice={offering.promoPrice}
              effectivePrice={offering.price}
              sku={offering.offeringKey}
              size="sm"
            />
          ) : (
            <p className="text-lg font-bold tabular-nums">{formatPeso(offering.price)}</p>
          )}

          {feeText ? <p className="mt-2 text-xs font-medium text-muted-foreground">{feeText}</p> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {feeText
              ? "The yearly fee is separate from the project price unless the quotation states it is included."
              : "One-time price. No yearly hosting or domain fee is published for this listing."}
          </p>

          <Button asChild variant="brand" size="sm" className="mt-4 w-full">
            <Link to={requestHref}>
              <FileText className="h-3.5 w-3.5" />
              Request this {offering.offeringGroup === "learning_package" ? "package" : "service"}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function DigitalSolutionsPage() {
  const { learningPackages, services, loading, error } = useDigitalOfferings();
  const learningIntro = useSiteText("site.digital.learning_intro", LEARNING_INTRO_FALLBACK);
  const servicesIntro = useSiteText("site.digital.services_intro", SERVICES_INTRO_FALLBACK);

  return (
    <SiteShell>
      <PageHero
        eyebrow="KMD Digital Solutions"
        title="Digital products, AI learning packages and client services"
        intro="Learning packages you can take today, and digital services we build for your business. Every listing opens a request form — a request asks us for a quotation, it is not a purchase."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link to="/digital-solutions/request">
              Start a request
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="hero-outline" size="lg">
            <Link to="/contact">Ask a question first</Link>
          </Button>
        </div>
      </PageHero>

      <Section
        title="Digital Products & AI Learning Packages"
        intro={learningIntro}
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-72 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : learningPackages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No learning package is published yet. Please check back shortly.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {learningPackages.map((offering, index) => (
              <OfferingCard key={offering.id} offering={offering} index={index} />
            ))}
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Learning packages are training and ebooks. They are delivered as described on each listing, and
          session dates are agreed with you after the request is reviewed — no schedule is assumed here.
        </p>
      </Section>

      <Section
        tone="muted"
        title="Digital Services for Clients"
        intro={servicesIntro}
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-72 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground">No service is published yet. Please check back shortly.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((offering, index) => (
              <OfferingCard key={offering.id} offering={offering} index={index} />
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: CalendarClock,
              title: "Project terms on websites and dashboards",
              detail:
                "Website and dashboard projects are 50% on signing and 50% after completion, shown as actual amounts on the quotation.",
            },
            {
              icon: ListChecks,
              title: "Yearly fees stay separate",
              detail:
                "Hosting or domain is billed yearly and shown on its own line. The exact label on each listing is the charge that applies.",
            },
            {
              icon: Users,
              title: "MLM dashboards: one maintenance choice",
              detail:
                "The co-partner arrangement (5% per qualifying entry-pack encoding) and client maintenance (₱50,000/month) are alternatives. Only one is ever recorded.",
            },
          ].map((note) => (
            <div key={note.title} className="kmd-panel flex gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <note.icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold">{note.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{note.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="How a request works">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: ShoppingBag, title: "Choose a listing", detail: "Open any package or service, or pick several on the request form." },
            { icon: FileText, title: "Send the details", detail: "Tell us the client, the business and what the project needs." },
            { icon: Building2, title: "We prepare a quotation", detail: "Scope, deliverables, prices and dates are set out in writing." },
            { icon: Clock, title: "You review and sign", detail: "Nothing is payable and no contract exists until you agree and sign." },
          ].map((step, index) => (
            <div key={step.title} className="kmd-panel p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <p className="mt-3 text-xs font-semibold">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{step.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild variant="brand">
            <Link to="/digital-solutions/request">
              <Sparkles className="h-4 w-4" />
              Open the request form
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/contact">
              <Layers className="h-4 w-4" />
              Talk to the team
            </Link>
          </Button>
        </div>
      </Section>
    </SiteShell>
  );
}
