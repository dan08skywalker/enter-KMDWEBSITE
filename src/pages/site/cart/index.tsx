import { Link } from "react-router-dom";
import { ArrowRight, Info, ShoppingBag, Trash2 } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { QuantityStepper } from "@/components/site/quantity-stepper";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/kmd/empty-state";
import { useCart } from "@/contexts/cart-context";
import { formatPeso } from "@/lib/kmd/format";

export default function CartPage() {
  const cart = useCart();

  return (
    <SiteShell>
      <PageHero
        eyebrow="Your bag"
        title="Review your bag"
        intro="Adjust quantities here. Delivery is calculated on the next step for the area you are in."
      />

      <Section>
        {cart.lines.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your bag is empty"
            description="Add something from the shop and it will appear here. Your bag is kept on this device, so it survives signing in or registering."
            action={
              <Button asChild variant="brand">
                <Link to="/shop">Shop all products</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <ul className="divide-y">
              {cart.lines.map((line) => (
                <li key={line.sku} className="flex gap-4 py-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-secondary">
                    {line.imageUrl ? (
                      <img
                        src={line.imageUrl}
                        alt={line.name}
                        crossOrigin="anonymous"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{line.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{line.sku}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatPeso(line.unitPrice)} each
                      {line.isDigital ? " · digital, no delivery fee" : ""}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <QuantityStepper
                        value={line.quantity}
                        onChange={(value) => cart.setQuantity(line.sku, value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => cart.remove(line.sku)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>

                  <p className="shrink-0 self-start text-sm font-bold tabular-nums">
                    {formatPeso(line.unitPrice * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <aside className="space-y-4">
              <div className="kmd-panel p-5">
                <p className="text-sm font-semibold">Order summary</p>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Items</dt>
                    <dd className="font-medium tabular-nums">{cart.count}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-bold tabular-nums">{formatPeso(cart.subtotal)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="text-xs text-muted-foreground">
                      {cart.requiresShipping ? "Calculated at checkout" : "Not applicable"}
                    </dd>
                  </div>
                </dl>

                <Button asChild variant="brand" size="lg" className="mt-5 w-full">
                  <Link to="/checkout">
                    Proceed to checkout
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <Button asChild variant="ghost" size="sm" className="mt-2 w-full">
                  <Link to="/shop">Continue shopping</Link>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-muted-foreground"
                  onClick={cart.clear}
                >
                  Empty my bag
                </Button>
              </div>

              <div className="kmd-panel flex gap-3 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Your bag is stored on this device, so it is still here if you sign in or register
                  before checking out.
                </p>
              </div>
            </aside>
          </div>
        )}
      </Section>
    </SiteShell>
  );
}
