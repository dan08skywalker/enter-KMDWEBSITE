import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriceTag } from "@/components/site/price-tag";
import { StockBadge } from "@/components/site/stock-badge";
import { useCart } from "@/contexts/cart-context";
import { toast } from "@/hooks/use-toast";
import { requestHrefForSku } from "@/lib/digital/types";
import type { StoreProduct } from "@/lib/site/types";

interface ProductCardProps {
  product: StoreProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation();
  const cart = useCart();

  const href = product.slug ? `/shop/${product.slug}` : "/shop";
  const canBuy = product.inStock;
  const requestHref = requestHrefForSku(product.sku);

  const addToCart = () => {
    cart.add(
      {
        sku: product.sku,
        name: product.name,
        unitPrice: product.effectivePrice,
        imageUrl: product.imageUrl,
        isDigital: product.isDigital,
      },
      1,
    );
    toast({
      title: "Added to your cart",
      description: `${product.name} is in your cart.`,
    });
  };

  return (
    <article className="kmd-panel group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-elegant)]">
      <Link to={href} className="relative block aspect-[4/3] overflow-hidden bg-secondary">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            crossOrigin="anonymous"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </span>
        )}
        {product.regularPrice && product.regularPrice > product.effectivePrice ? (
          <span className="absolute left-3 top-3 whitespace-nowrap rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold-foreground">
            {t("product.promo")}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="kmd-eyebrow text-muted-foreground">{product.category}</p>
        <h3 className="mt-1.5 text-sm font-semibold leading-snug">
          <Link to={href} className="hover:text-accent">
            {product.name}
          </Link>
        </h3>

        {product.eyebrow ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{product.eyebrow}</p>
        ) : null}

        <div className="mt-3">
          <StockBadge
            inStock={product.inStock}
            lowStock={product.lowStock}
            availableQuantity={product.availableQuantity}
            isDigital={product.isDigital}
          />
        </div>

        <div className="mt-auto pt-4">
          <PriceTag
            regularPrice={product.regularPrice}
            promoPrice={product.promoPrice}
            effectivePrice={product.effectivePrice}
            sku={product.sku}
            size="sm"
          />

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="flex-1"
              disabled={!canBuy}
              onClick={addToCart}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {canBuy ? t("common.addToBag") : t("common.unavailable")}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={href}>{t("common.viewDetails")}</Link>
            </Button>
          </div>

          {requestHref ? (
            <Button asChild variant="ghost" size="sm" className="mt-1 w-full text-accent">
              <Link to={requestHref}>
                <FileText className="h-3.5 w-3.5" />
                Request a quotation
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
