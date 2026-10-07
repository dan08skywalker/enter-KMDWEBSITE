import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Droplets,
  Flame,
  HeartPulse,
  Lightbulb,
  MonitorSmartphone,
  Shirt,
  Sparkles,
} from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ShopCta, TrustStrip, BrandTile } from "@/components/site/site-blocks";
import { ProductCard } from "@/components/site/product-card";
import { PriceTag } from "@/components/site/price-tag";
import { StockBadge } from "@/components/site/stock-badge";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { TestimonialGrid } from "@/components/site/testimonial-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/kmd/status-badge";
import { useStore } from "@/contexts/store-context";
import { packageTier } from "@/lib/kmd/labels";
import {
  CLOSET_FEATURES,
  COMPANY,
  DIGITAL_SERVICES,
  DOKUDAMI_FEATURES,
  DOKUDAMI_REVIEW_URL,
  FAQS,
  HOMEPAGE_CATEGORIES,
  LED_BULB_FEATURES,
  POWERPILL_BENEFITS,
} from "@/lib/site/content";

const CATEGORY_ICONS: Record<string, typeof HeartPulse> = {
  Wellness: HeartPulse,
  "Fuel Additive": Flame,
  "Home & Lighting": Lightbulb,
  Apparel: Shirt,
  "Digital Services": MonitorSmartphone,
};

const SPOTLIGHT_VALUES = [
  { level: "Level 1", detail: "The direct sponsor of the buyer earns the configured Level 1 value." },
  { level: "Level 2", detail: "The sponsor's own sponsor earns the configured Level 2 value." },
  { level: "Levels 3–5", detail: "Traced automatically from the registered sponsor chain." },
];

export default function HomePage() {
  const { products, packages, loading } = useStore();

  const featured = products.filter((product) => product.inStock).slice(0, 4);
  const fallbackFeatured = featured.length > 0 ? featured : products.slice(0, 4);
  const hero = products.find((product) => product.productType === "reorder") ?? products[0] ?? null;

  const dokudami = products.find((product) => product.sku === "KMD-DOKUDAMI-001") ?? null;
  const powerpill = products.find((product) => product.sku === "KMD-POWERPILL-75L") ?? null;
  const ledBulb = products.find((product) => product.sku === "KMD-LED-BULB") ?? null;
  const closet = products.find((product) => product.sku === "KMD-CLOSET") ?? null;
  const digital = products.find((product) => product.sku === "KMD-DIGITAL-LP") ?? null;

  return (
    <SiteShell>
      {/* ---------------- hero ---------------- */}
      <section className="kmd-hero relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              {COMPANY.positioning}
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
              Problem-solving products for health, home and everyday living
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {COMPANY.intro}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="gold" size="xl">
                <Link to="/shop">
                  Shop now
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="hero-outline" size="xl">
                <Link to="/register">Become a member</Link>
              </Button>
              <Button asChild variant="hero-ghost" size="xl" className="text-white underline underline-offset-4">
                <Link to="/packages">See membership packages</Link>
              </Button>
            </div>

            <p className="mt-6 text-xs text-white/60">
              {COMPANY.poweredBy} {COMPANY.legalParent}.
            </p>
          </div>

          {/* Featured best seller — real catalogue data, real stock. */}
          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur">
            <p className="kmd-eyebrow text-gold">Best seller</p>
            {loading ? (
              <Skeleton className="mt-3 h-64 w-full" />
            ) : hero ? (
              <div className="mt-3 overflow-hidden rounded-xl bg-white">
                {hero.imageUrl ? (
                  <img
                    src={hero.imageUrl}
                    alt={hero.name}
                    crossOrigin="anonymous"
                    className="h-52 w-full object-cover"
                  />
                ) : null}
                <div className="p-4">
                  <p className="kmd-eyebrow text-muted-foreground">{hero.category}</p>
                  <p className="mt-1 text-sm font-semibold">{hero.name}</p>
                  <div className="mt-2">
                    <PriceTag
                      regularPrice={hero.regularPrice}
                      promoPrice={hero.promoPrice}
                      effectivePrice={hero.effectivePrice}
                      size="sm"
                    />
                  </div>
                  <div className="mt-3">
                    <StockBadge
                      inStock={hero.inStock}
                      lowStock={hero.lowStock}
                      availableQuantity={hero.availableQuantity}
                      isDigital={hero.isDigital}
                    />
                  </div>
                  <Button asChild variant="brand" size="sm" className="mt-4 w-full">
                    <Link to={hero.slug ? `/shop/${hero.slug}` : "/shop"}>
                      View product
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-white/10 p-4 text-xs text-white/70">
                The catalogue is being prepared. Please check back shortly.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- trust strip ---------------- */}
      <div className="mx-auto -mt-8 w-full max-w-6xl px-4 sm:px-6">
        <TrustStrip className="relative z-10" />
      </div>

      {/* ---------------- brand banner ---------------- */}
      <Section
        title="We distribute problem-solving products"
        intro="Smart solutions for a better tomorrow — selected and backed by GreenChoyce."
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <img
              src="/brand/hero-products.png"
              alt="KMD Empire distributes problem-solving products across automotive, home and health categories"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col gap-4">
            <BrandTile />
            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Our mission</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{COMPANY.mission}</p>
              <p className="kmd-eyebrow mt-4 text-accent">Our vision</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{COMPANY.vision}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------- best sellers ---------------- */}
      <Section
        tone="muted"
        title="Best-selling products"
        intro="Live prices straight from the catalogue — the promotional price is what you pay, and the regular price is what it replaces."
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-80 w-full" />
            ))}
          </div>
        ) : fallbackFeatured.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products are published yet. Please check back shortly.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {fallbackFeatured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="mt-6">
              <Button asChild variant="outline">
                <Link to="/shop">
                  View all products
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </Section>

      {/* ---------------- categories ---------------- */}
      <Section title="Shop by category" intro="Five ranges that cover the everyday essentials.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOMEPAGE_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.name] ?? Sparkles;
            return (
              <Link
                key={category.name}
                to={`/shop?category=${encodeURIComponent(category.name)}`}
                className="kmd-panel group flex flex-col p-5 transition-shadow hover:shadow-[var(--shadow-elegant)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">{category.name}</p>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{category.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-accent">
                  Browse
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* ---------------- Dokudami spotlight ---------------- */}
      <Section tone="muted">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <img
              src={dokudami?.imageUrl ?? "/products/dokudami.png"}
              alt="Dokudami Capsules"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="kmd-eyebrow text-accent">EGC Dokudami Capsules</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Discover the natural power of Dokudami
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {dokudami?.description ??
                "Everyday wellness support in capsule form, made with Houttuynia cordata (dokudami)."}
            </p>

            <ul className="mt-5 space-y-2">
              {DOKUDAMI_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs text-foreground/85">
                  <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            {dokudami ? (
              <div className="mt-6">
                <PriceTag
                  regularPrice={dokudami.regularPrice}
                  promoPrice={dokudami.promoPrice}
                  effectivePrice={dokudami.effectivePrice}
                  size="lg"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StockBadge
                    inStock={dokudami.inStock}
                    lowStock={dokudami.lowStock}
                    availableQuantity={dokudami.availableQuantity}
                  />
                  <Button asChild variant="brand">
                    <Link to={dokudami.slug ? `/shop/${dokudami.slug}` : "/shop"}>
                      Shop this product
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-xl border border-primary/20 bg-secondary/60 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                Read the science for yourself
              </p>
              <a
                href={DOKUDAMI_REVIEW_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 block text-xs text-accent underline underline-offset-2"
              >
                Pharmacological Effects of Houttuynia cordata: A Comprehensive Review
              </a>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                This publication summarises existing scientific research on Houttuynia cordata and its
                naturally occurring compounds. It is educational reading and is not evidence that any
                supplement can diagnose, treat, cure or prevent a disease.
              </p>
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              {dokudami?.disclaimer ??
                "This product is a food supplement and is not intended to diagnose, treat, cure or prevent any disease."}
            </p>
          </div>
        </div>
      </Section>

      {/* ---------------- PowerPill spotlight ---------------- */}
      <Section>
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="kmd-eyebrow text-accent">PowerPill Plus</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Drive smarter. Drive farther. Save more.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Advanced fuel conditioning technology designed for gasoline and diesel engines,
              available for full-size fuel tanks and for motorcycles and small engines.
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {POWERPILL_BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-xs text-foreground/85">
                  <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  {benefit}
                </li>
              ))}
            </ul>

            {powerpill ? (
              <div className="mt-6">
                <PriceTag
                  regularPrice={powerpill.regularPrice}
                  promoPrice={powerpill.promoPrice}
                  effectivePrice={powerpill.effectivePrice}
                  size="lg"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StockBadge
                    inStock={powerpill.inStock}
                    lowStock={powerpill.lowStock}
                    availableQuantity={powerpill.availableQuantity}
                  />
                  <Button asChild variant="brand">
                    <Link to={powerpill.slug ? `/shop/${powerpill.slug}` : "/shop"}>
                      Shop PowerPill Plus
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              {powerpill?.disclaimer ??
                "Performance results may vary depending on engine condition, fuel quality and operating conditions."}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card">
            <img
              src="/products/powerpill.jpeg"
              alt="PowerPill Plus real benefits, real impact"
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Section>

      {/* ---------------- LED bulb / closet / digital ---------------- */}
      <Section tone="muted" title="Also in the shop">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { product: ledBulb, features: LED_BULB_FEATURES, icon: Lightbulb, fallbackImage: "/products/led-bulb.png" },
            { product: closet, features: CLOSET_FEATURES, icon: Shirt, fallbackImage: "/products/kmd-closet.jpeg" },
            { product: digital, features: DIGITAL_SERVICES, icon: MonitorSmartphone, fallbackImage: "/products/digital-services.png" },
          ].map((entry, index) => {
            const Icon = entry.icon;
            const title = entry.product?.name ?? ["Intelligent Emergency LED Bulb", "KMD Closet Apparel", "Website & Landing Page Service"][index];
            return (
              <div key={title} className="kmd-panel flex flex-col overflow-hidden">
                <img
                  src={entry.product?.imageUrl ?? entry.fallbackImage}
                  alt={title}
                  crossOrigin="anonymous"
                  className="h-48 w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-sm font-semibold">{title}</p>
                  <ul className="mt-3 flex-1 space-y-1.5">
                    {entry.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="text-[11px] leading-relaxed text-muted-foreground">
                        • {feature}
                      </li>
                    ))}
                  </ul>

                  {entry.product ? (
                    <div className="mt-4">
                      <PriceTag
                        regularPrice={entry.product.regularPrice}
                        promoPrice={entry.product.promoPrice}
                        effectivePrice={entry.product.effectivePrice}
                        size="sm"
                      />
                      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                        <Link to={entry.product.slug ? `/shop/${entry.product.slug}` : "/shop"}>
                          View details
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ---------------- membership ---------------- */}
      <Section
        title="Membership packages"
        intro="Join the plan and earn Unilevel points when a purchase in your sponsor chain is paid and confirmed. A purchase earns nothing until then."
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-44 w-full" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No membership package is published yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => {
              const tier = packageTier(pkg.tier);
              return (
                <div key={pkg.id} className="kmd-panel flex flex-col p-5">
                  <StatusBadge label={tier.label} tone={tier.tone} />
                  <p className="mt-3 text-sm font-semibold">{pkg.name}</p>
                  <p className="mt-1 flex-1 text-xs text-muted-foreground">{pkg.productName}</p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">{pkg.sku}</p>
                  {pkg.effectivePrice > 0 ? (
                    <PriceTag
                      regularPrice={pkg.regularPrice}
                      promoPrice={pkg.promoPrice}
                      effectivePrice={pkg.effectivePrice}
                      size="sm"
                      className="mt-3"
                    />
                  ) : (
                    <p className="mt-3 text-xs font-semibold text-warning">
                      Price to be published
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="kmd-panel p-6">
            <h3 className="text-sm font-semibold">How the five levels pay</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              When a purchase in your team is paid and confirmed, the system traces upward from the
              buyer through the registered sponsor chain.
            </p>
            <ul className="mt-4 space-y-3">
              {SPOTLIGHT_VALUES.map((row) => (
                <li key={row.level} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                    {row.level}
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{row.detail}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link to="/referral-program">
                How the referral program works
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="kmd-brand-tile flex flex-col justify-between">
            <div>
              <div className="kmd-gold-rule" />
              <h3 className="mt-4 text-lg font-bold text-white">Join the plan</h3>
              <p className="mt-2 text-xs leading-relaxed text-white/80">
                Register in one step. If a member shared their referral link with you, open that link
                and your sponsor is locked automatically so your placement is correct from day one.
              </p>
            </div>
            <div className="mt-5 grid gap-2">
              <Button asChild variant="gold">
                <Link to="/register">Create my member account</Link>
              </Button>
              <Button asChild variant="hero-outline" size="sm">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ---------------- testimonials ---------------- */}
      <Section tone="muted" title="What our customers say">
        <TestimonialGrid />
        <p className="mt-4 text-[11px] text-muted-foreground">
          Testimonials describe individual experiences. They are not a claim about results you will
          get, and supplement products are not intended to diagnose, treat, cure or prevent any
          disease.
        </p>
      </Section>

      {/* ---------------- knowledge + FAQ ---------------- */}
      <Section title="Learn before you buy">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">From the knowledge centre</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Plain-language guides on ingredients, payment verification and how the member plan
              actually settles.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/knowledge">
                <BookOpen className="h-3.5 w-3.5" />
                Open the knowledge centre
              </Link>
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Frequently asked questions</h3>
            <div className="mt-3">
              <FaqAccordion entries={FAQS.slice(0, 5)} />
            </div>
            <Button asChild variant="ghost" size="sm" className="mt-2 px-0 text-accent">
              <Link to="/faqs">
                All questions
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>

      <Section>
        <PageHeroTitleless />
      </Section>

      <Section className="pt-0">
        <ShopCta />
      </Section>
    </SiteShell>
  );
}

/** Minimal callout above the closing CTA, kept visually quiet. */
function PageHeroTitleless() {
  return (
    <div className="kmd-panel flex flex-col items-center gap-4 px-6 py-10 text-center">
      <Sparkles className="h-7 w-7 text-gold" />
      <h2 className="text-xl font-bold tracking-tight">Ready to be part of our community?</h2>
      <p className="max-w-xl text-sm text-muted-foreground">
        Join thousands of customers who trust our wellness, fuel-saving and energy-efficient
        solutions.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="brand">
          <Link to="/shop">Start shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/products">View all products</Link>
        </Button>
      </div>
    </div>
  );
}
