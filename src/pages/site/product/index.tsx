import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Phone,
  ShoppingBag,
  Truck,
  ZoomIn,
} from "lucide-react";
import { Section, SiteShell } from "@/components/site/site-shell";
import { PriceTag } from "@/components/site/price-tag";
import { StockBadge } from "@/components/site/stock-badge";
import { QuantityStepper } from "@/components/site/quantity-stepper";
import { ProductCard } from "@/components/site/product-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/contexts/store-context";
import { useCart } from "@/contexts/cart-context";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DOKUDAMI_REVIEW_URL, SUPPLEMENT_DISCLAIMER } from "@/lib/site/content";
import type { StoreProduct } from "@/lib/site/types";

export default function ProductDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { products, loading: catalogLoading } = useStore();
  const cart = useCart();

  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);

  // The catalogue already holds everything, so prefer it and only fall back to
  // the single-product lookup when a deep link arrives before the catalogue does.
  const fromCatalog = useMemo(
    () => products.find((row) => row.slug === slug) ?? null,
    [products, slug],
  );

  useEffect(() => {
    if (fromCatalog) {
      setProduct(fromCatalog);
      setActiveImage(fromCatalog.imageUrl);
      setLoading(false);
      setNotFound(false);
      return;
    }
    if (catalogLoading) return;

    let active = true;
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase.rpc("kmd_storefront_product", { p_slug: slug });
      if (!active) return;

      if (error) {
        console.error("Could not load the product:", error.message);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const payload = (data ?? {}) as unknown as StoreProduct & { found?: boolean };
      if (payload.found === false || !payload.id) {
        setNotFound(true);
      } else {
        setProduct(payload);
        setActiveImage(payload.imageUrl);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug, fromCatalog, catalogLoading]);

  const related = useMemo(
    () =>
      product
        ? products.filter((row) => row.sku !== product.sku && row.category === product.category).slice(0, 4)
        : [],
    [products, product],
  );

  const addToCart = () => {
    if (!product) return;
    cart.add(
      {
        sku: product.sku,
        name: product.name,
        unitPrice: product.effectivePrice,
        imageUrl: product.imageUrl,
        isDigital: product.isDigital,
      },
      quantity,
    );
    toast({
      title: "Added to your cart",
      description: `${quantity} × ${product.name}`,
    });
  };

  const buyNow = () => {
    if (!product) return;
    addToCart();
    navigate("/checkout");
  };

  if (loading) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-1/2" />
            </div>
          </div>
        </div>
      </SiteShell>
    );
  }

  if (notFound || !product) {
    return (
      <SiteShell>
        <div className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-bold">We could not find that product</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The product may have been retired. Browse the shop to see what is available today.
          </p>
          <Button asChild variant="brand" className="mt-6">
            <Link to="/shop">Back to the shop</Link>
          </Button>
        </div>
      </SiteShell>
    );
  }

  const gallery = (product.gallery ?? []).filter((image) => typeof image === "string" && image);
  const images = gallery.length > 0 ? gallery : product.imageUrl ? [product.imageUrl] : [];
  const isDokudami = product.sku === "KMD-DOKUDAMI-001";
  const maxQuantity = product.availableQuantity === null ? 99 : Math.min(product.availableQuantity, 99);

  return (
    <SiteShell>
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex w-full max-w-6xl items-center gap-1.5 px-4 pt-6 text-[11px] text-muted-foreground sm:px-6"
      >
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          {/* ---- gallery ---- */}
          <div>
            <div className="kmd-panel relative overflow-hidden">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  crossOrigin="anonymous"
                  className={`aspect-square w-full object-cover transition-transform duration-300 ${
                    zoom ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"
                  }`}
                  onClick={() => setZoom((value) => !value)}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-secondary">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold text-foreground">
                <ZoomIn className="h-3 w-3" />
                {zoom ? "Tap to zoom out" : "Tap to zoom in"}
              </span>
            </div>

            {images.length > 1 ? (
              <div className="mt-3 flex gap-2">
                {images.map((image) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => {
                      setActiveImage(image);
                      setZoom(false);
                    }}
                    className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors ${
                      activeImage === image ? "border-gold" : "border-transparent"
                    }`}
                    aria-label={`Show image of ${product.name}`}
                  >
                    <img
                      src={image}
                      alt=""
                      crossOrigin="anonymous"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* ---- buy box ---- */}
          <div>
            <p className="kmd-eyebrow text-accent">{product.brand ?? product.category}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StockBadge
                inStock={product.inStock}
                lowStock={product.lowStock}
                availableQuantity={product.availableQuantity}
                isDigital={product.isDigital}
              />
              <span className="font-mono text-[11px] text-muted-foreground">{product.sku}</span>
            </div>

            <div className="mt-5 border-y py-5">
              <PriceTag
                regularPrice={product.regularPrice}
                promoPrice={product.promoPrice}
                effectivePrice={product.effectivePrice}
                size="lg"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {product.isDigital
                  ? "One-time service fee. Scope is agreed with you before work begins."
                  : "Promotional price while stocks last. Delivery is calculated at checkout."}
              </p>
            </div>

            {product.description ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                max={Math.max(maxQuantity, 1)}
                disabled={!product.inStock}
              />
              <Button
                type="button"
                variant="brand"
                size="lg"
                disabled={!product.inStock}
                onClick={addToCart}
                className="flex-1 sm:flex-none"
              >
                <ShoppingBag className="h-4 w-4" />
                {product.inStock ? "Add to cart" : "Out of stock"}
              </Button>
              <Button
                type="button"
                variant="gold"
                size="lg"
                disabled={!product.inStock}
                onClick={buyNow}
              >
                Buy now
              </Button>
            </div>

            {!product.inStock && !product.isDigital ? (
              <p className="mt-3 rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs text-foreground">
                This product is not in stock right now. Contact us and we will let you know as soon
                as it is back.
              </p>
            ) : null}

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {product.isDigital
                  ? "Delivered remotely — no shipping fee."
                  : "Luzon, Visayas and Mindanao, with the fee shown before you pay."}
              </li>
              <li className="flex items-start gap-2 text-xs text-muted-foreground">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Payment is verified by our team before the order is confirmed.
              </li>
            </ul>

            <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
              {product.disclaimer ??
                (isDokudami
                  ? SUPPLEMENT_DISCLAIMER
                  : "Please read the product description before ordering.")}
            </p>

            {isDokudami ? (
              <div className="mt-5 rounded-xl border border-primary/20 bg-secondary/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  Further reading
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
                  Educational reading on the botanical, not evidence of an outcome from this
                  supplement. If you are pregnant, nursing, taking medication or managing a health
                  condition, speak with your doctor before use.
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/contact">
                  <Phone className="h-3.5 w-3.5" />
                  Ask a question
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-accent">
                <Link to="/refund-policy">Return &amp; refund policy</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section tone="muted" title={`More in ${product.category}`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((row) => (
              <ProductCard key={row.id} product={row} />
            ))}
          </div>
        </Section>
      ) : null}

      <Section className="pt-0">
        <Button asChild variant="outline" size="sm">
          <Link to="/shop">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to the shop
          </Link>
        </Button>
      </Section>
    </SiteShell>
  );
}
