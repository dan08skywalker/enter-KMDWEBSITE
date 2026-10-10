import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Search, SlidersHorizontal } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ProductCard } from "@/components/site/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/kmd/empty-state";
import { ArrowRight, MonitorSmartphone } from "lucide-react";
import { useStore } from "@/contexts/store-context";
import { toNumber } from "@/lib/kmd/format";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

const SORT_KEYS: Record<SortKey, string> = {
  featured: "sort.featured",
  "price-asc": "sort.priceAsc",
  "price-desc": "sort.priceDesc",
  name: "sort.name",
};

export default function ShopPage() {
  const { t } = useTranslation();
  const { products, loading } = useStore();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get("q") ?? "");
  const [sort, setSort] = useState<SortKey>("featured");
  const [maxPrice, setMaxPrice] = useState("");

  const activeCategory = params.get("category") ?? "all";

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort(),
    [products],
  );

  const visible = useMemo(() => {
    const ceiling = maxPrice.trim() === "" ? null : toNumber(maxPrice, Number.POSITIVE_INFINITY);
    const needle = query.trim().toLowerCase();

    const filtered = products.filter((product) => {
      if (activeCategory !== "all" && product.category !== activeCategory) return false;
      if (ceiling !== null && product.effectivePrice > ceiling) return false;
      if (!needle) return true;
      return (
        product.name.toLowerCase().includes(needle) ||
        (product.eyebrow ?? "").toLowerCase().includes(needle) ||
        (product.description ?? "").toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle)
      );
    });

    const sorted = [...filtered];
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.effectivePrice - b.effectivePrice);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.effectivePrice - a.effectivePrice);
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
    return sorted;
  }, [products, activeCategory, query, sort, maxPrice]);

  const applyCategory = (category: string) => {
    const next = new URLSearchParams(params);
    if (category === "all") next.delete("category");
    else next.set("category", category);
    setParams(next, { replace: true });
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Shop"
        title={t("shop.title")}
        intro={t("shop.intro")}
      />

      <Section className="pb-0">
        <div className="kmd-panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <MonitorSmartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">KMD Digital Solutions</p>
              <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                Digital AI learning packages and client services — landing pages, e-commerce websites and
                business or MLM dashboards. Open any listing to send a request; a request asks us for a
                written quotation and takes no payment.
              </p>
            </div>
          </div>
          <Button asChild variant="brand">
            <Link to="/digital-solutions">
              <ArrowRight className="h-4 w-4" />
              View digital packages &amp; services
            </Link>
          </Button>
        </div>
      </Section>

      <Section>
        <div className="kmd-panel grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("shop.search")}
              className="pl-9"
              aria-label={t("shop.search")}
            />
          </div>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger aria-label={t("shop.sort")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_KEYS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {t(SORT_KEYS[key])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={maxPrice}
              inputMode="decimal"
              onChange={(event) => setMaxPrice(event.target.value.replace(/[^0-9.]/g, ""))}
              placeholder={t("shop.maxPrice")}
              className="pl-9"
              aria-label={t("shop.maxPrice")}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeCategory === "all" ? "brand" : "outline"}
            size="sm"
            onClick={() => applyCategory("all")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {t("shop.allProducts")}
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              type="button"
              variant={activeCategory === category ? "brand" : "outline"}
              size="sm"
              onClick={() => applyCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {loading ? t("shop.loading") : t("shop.count", { count: visible.length })}
        </p>
      </Section>

      <Section className="pt-0">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <Skeleton key={row} className="h-80 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={t("shop.empty.title")}
            description={t("shop.empty.description")}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </Section>
    </SiteShell>
  );
}
