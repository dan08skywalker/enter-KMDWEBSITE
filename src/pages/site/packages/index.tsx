import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { ArrowRight, Coins, CreditCard, ShieldCheck, Sparkles, Users } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { PriceTag } from "@/components/site/price-tag";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/kmd/status-badge";
import { useStore } from "@/contexts/store-context";
import { useCart } from "@/contexts/cart-context";
import { toast } from "@/hooks/use-toast";
import { packageTier } from "@/lib/kmd/labels";
import { FAQS } from "@/lib/site/content";

const MEMBER_BENEFITS = [
  {
    icon: Coins,
    title: "Unilevel points",
    detail:
      "Earn when a purchase in your registered sponsor chain is paid and confirmed — up to five levels up from the buyer.",
  },
  {
    icon: Sparkles,
    title: "Separate loyalty credits",
    detail:
      "Loyalty Credits are tracked in their own ledger and balance, so they can never distort your Unilevel points.",
  },
  {
    icon: CreditCard,
    title: "A loyalty card",
    detail:
      "Confirming a package purchase issues the matching loyalty card to your member profile.",
  },
  {
    icon: Users,
    title: "A real team tree",
    detail:
      "Your genealogy is built from the Sponsor IDs recorded at registration, not from hand-maintained lists.",
  },
  {
    icon: ShieldCheck,
    title: "Everything on a ledger",
    detail:
      "Every bonus is a permanent ledger entry with an idempotency key, so a repeated confirmation can never pay twice.",
  },
];

export default function PackagesPage() {
  const { packages, loading } = useStore();
  const cart = useCart();

  const addPackage = (pkg: (typeof packages)[number]) => {
    cart.add(
      {
        sku: pkg.sku,
        name: pkg.name,
        unitPrice: pkg.effectivePrice,
        imageUrl: pkg.imageUrl,
        isDigital: false,
      },
      1,
    );
    toast({
      title: "Added to your cart",
      description: `${pkg.name} is in your cart.`,
    });
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Membership"
        title="Join the plan and earn on verified purchases"
        intro="A purchase earns nothing on its own. Rewards are released only when the payment is confirmed, and every payment is written to a permanent ledger."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link to="/register">
              Register now
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="hero-outline" size="lg">
            <Link to="/referral-program">How the plan works</Link>
          </Button>
        </div>
      </PageHero>

      <Section
        title="Membership packages"
        intro="Each package is its own product bundle. The promotional price is what you pay and the SRP is what it replaces."
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-56 w-full" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No membership package is published yet. Please check back shortly.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => {
              const tier = packageTier(pkg.tier);
              const purchasable = pkg.effectivePrice > 0;
              const detailHref = pkg.slug ? `/shop/${pkg.slug}` : "/shop";
              return (
                <div key={pkg.id} className="kmd-panel group flex flex-col overflow-hidden">
                  <Link to={detailHref} className="relative block aspect-[16/9] overflow-hidden bg-secondary">
                    {pkg.imageUrl ? (
                      <img
                        src={pkg.imageUrl}
                        alt={pkg.name}
                        loading="lazy"
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                      </span>
                    )}
                    <span className="absolute left-3 top-3">
                      <StatusBadge label={tier.label} tone={tier.tone} />
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-sm font-semibold">{pkg.name}</p>
                    <p className="mt-1 flex-1 text-xs text-muted-foreground">
                      {pkg.eyebrow ?? pkg.productName}
                    </p>
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">{pkg.sku}</p>

                    {purchasable ? (
                      <PriceTag
                        regularPrice={pkg.regularPrice}
                        promoPrice={pkg.promoPrice}
                        effectivePrice={pkg.effectivePrice}
                        sku={pkg.sku}
                        size="sm"
                        className="mt-4"
                      />
                    ) : (
                      <p className="mt-4 text-xs font-semibold text-warning">
                        Pricing to be published
                      </p>
                    )}

                    <Button
                      type="button"
                      variant={purchasable ? "brand" : "outline"}
                      size="sm"
                      className="mt-4"
                      disabled={!purchasable}
                      onClick={() => addPackage(pkg)}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {purchasable ? "Add to cart" : "Awaiting pricing"}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="mt-1 text-accent">
                      <Link to={detailHref}>See what is included</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section tone="muted" title="What membership includes">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEMBER_BENEFITS.map((benefit) => (
            <div key={benefit.title} className="kmd-panel flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <benefit.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{benefit.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{benefit.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          The value paid at each level is configured per product by the administrator. Products with
          no configured values pay nothing, and no income is guaranteed by joining the plan.
        </p>
      </Section>

      <Section title="Membership questions">
        <FaqAccordion entries={FAQS.filter((entry) => /member|plan|account/i.test(entry.question))} />
      </Section>
    </SiteShell>
  );
}
