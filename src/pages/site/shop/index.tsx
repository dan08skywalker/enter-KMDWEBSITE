import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useStore } from "@/contexts/store-context";
import { toNumber } from "@/lib/kmd/format";

type SortKey = "featured" | "price-asc" | "price-desc" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  name: "Name: A to Z",
};

export default function ShopPage() {
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
        title="Everything KMD Empire sells, in one place"
        intro="Promotional prices sit next to the regular price they replace, and stock shown here is the stock we can actually ship."
      />

      <Section>
        <div className="kmd-panel grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products by name, SKU or description"
              className="pl-9"
              aria-label="Search products"
            />
          </div>

          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger aria-label="Sort products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
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
              placeholder="Max price (PHP)"
              className="pl-9"
              aria-label="Maximum price"
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
            All products
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
          {loading
            ? "Loading the catalogue…"
            : `${visible.length} product${visible.length === 1 ? "" : "s"} shown`}
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
            title="No products match those filters"
            description="Try clearing the search box, choosing a different category or raising the maximum price."
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
