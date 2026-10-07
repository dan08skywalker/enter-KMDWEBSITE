import { Leaf, Recycle, ShieldCheck, Sparkles } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ShopCta, BrandTile } from "@/components/site/site-blocks";
import { COMPANY, TRUST_SIGNALS } from "@/lib/site/content";
import { MEMBER_ID_FORMAT } from "@/lib/kmd/constants";

const VALUES = [
  {
    icon: Leaf,
    title: "Innovation with a purpose",
    detail:
      "Every product is selected to solve a specific everyday problem rather than to fill a shelf.",
  },
  {
    icon: Recycle,
    title: "Sustainability as a standard",
    detail:
      "We favour products that reduce waste, reduce emissions or replace something that would otherwise be thrown away.",
  },
  {
    icon: ShieldCheck,
    title: "Quality you can verify",
    detail:
      "Prices, stock and warranties are published on the product page, and payments are verified by a person before an order is confirmed.",
  },
  {
    icon: Sparkles,
    title: "Value without the markup",
    detail:
      "We publish the regular price alongside the promotional price so you can see exactly what you are saving.",
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="About us"
        title={COMPANY.positioning}
        intro={COMPANY.intro}
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="kmd-panel overflow-hidden">
            <img
              src="/brand/hero-products.png"
              alt="KMD Empire product range across automotive, home and health"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="space-y-4">
            <BrandTile />
            <div className="kmd-panel p-6">
              <p className="kmd-eyebrow text-accent">Mission</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{COMPANY.mission}</p>

              <p className="kmd-eyebrow mt-5 text-accent">Vision</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{COMPANY.vision}</p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        tone="muted"
        title="Why customers stay"
        intro="The commitments behind the storefront, in plain terms."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_SIGNALS.map((signal) => (
            <div key={signal.title} className="kmd-panel p-5">
              <p className="text-sm font-semibold">{signal.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{signal.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What we stand for">
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((value) => (
            <div key={value.title} className="kmd-panel flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <value.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{value.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{value.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted" title="The company behind the storefront">
        <div className="grid gap-6 lg:grid-cols-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {COMPANY.parentBlurb} {COMPANY.aboutVision}
          </p>
          <div className="kmd-panel p-6">
            <p className="kmd-eyebrow text-accent">At a glance</p>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Trading name</dt>
                <dd className="font-semibold">{COMPANY.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Parent company</dt>
                <dd className="font-semibold">{COMPANY.legalParent}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Website</dt>
                <dd className="font-semibold">{COMPANY.website}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Member ID format</dt>
                <dd className="font-mono font-semibold">{MEMBER_ID_FORMAT}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <ShopCta />
      </Section>
    </SiteShell>
  );
}
