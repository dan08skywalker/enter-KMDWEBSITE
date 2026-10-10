import { Link } from "react-router-dom";
import { ArrowRight, Flame, HeartPulse, Lightbulb, MonitorSmartphone, Shirt } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ShopCta } from "@/components/site/site-blocks";
import { ProductCard } from "@/components/site/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/contexts/store-context";
import { HOMEPAGE_CATEGORIES } from "@/lib/site/content";

const ICONS: Record<string, typeof HeartPulse> = {
  Wellness: HeartPulse,
  "Fuel Additive": Flame,
  "Home & Lighting": Lightbulb,
  Apparel: Shirt,
  "Digital Services": MonitorSmartphone,
};

export default function ProductsPage() {
  const { products, loading } = useStore();

  return (
    <SiteShell>
      <PageHero
        eyebrow="Products"
        title="Five ranges, one standard of quality"
        intro="Wellness, fuel conditioning, home lighting, apparel and digital services — each range is chosen because it solves an everyday problem."
      />

      <Section>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-80 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-14">
            {HOMEPAGE_CATEGORIES.map((category) => {
              const rows = products.filter((product) => product.category === category.name);
              if (rows.length === 0) return null;
              const Icon = ICONS[category.name] ?? HeartPulse;

              return (
                <div key={category.name}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold tracking-tight">{category.name}</h2>
                        <p className="text-xs text-muted-foreground">{category.blurb}</p>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="text-accent">
                      <Link to={`/shop?category=${encodeURIComponent(category.name)}`}>
                        Shop {category.name}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {rows.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section className="pt-0">
        <ShopCta />
      </Section>
    </SiteShell>
  );
}
