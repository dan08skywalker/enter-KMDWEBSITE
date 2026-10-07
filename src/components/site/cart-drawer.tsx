import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCart } from "@/contexts/cart-context";
import { formatPeso } from "@/lib/kmd/format";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const cart = useCart();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4" />
            Your bag
          </SheetTitle>
          <SheetDescription className="text-xs">
            {cart.count === 0
              ? "Nothing here yet."
              : `${cart.count} item${cart.count === 1 ? "" : "s"} ready to check out.`}
          </SheetDescription>
        </SheetHeader>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Your bag is empty. Browse the shop to get started.
            </p>
            <Button asChild variant="brand" onClick={() => onOpenChange(false)}>
              <Link to="/shop">Shop all products</Link>
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-5">
              <ul className="divide-y">
                {cart.lines.map((line) => (
                  <li key={line.sku} className="flex gap-3 py-4">
                    <Link
                      to="/shop"
                      onClick={() => onOpenChange(false)}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-secondary"
                    >
                      {line.imageUrl ? (
                        <img
                          src={line.imageUrl}
                          alt={line.name}
                          crossOrigin="anonymous"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{line.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{line.sku}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatPeso(line.unitPrice)} each
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-r-none"
                            onClick={() => cart.setQuantity(line.sku, line.quantity - 1)}
                            aria-label={`Reduce quantity of ${line.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-xs font-semibold tabular-nums">
                            {line.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-l-none"
                            disabled={line.quantity >= 99}
                            onClick={() => cart.setQuantity(line.sku, line.quantity + 1)}
                            aria-label={`Increase quantity of ${line.name}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          onClick={() => cart.remove(line.sku)}
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>

                    <p className="shrink-0 text-sm font-bold tabular-nums">
                      {formatPeso(line.unitPrice * line.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            <div className="border-t px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold tabular-nums">{formatPeso(cart.subtotal)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {cart.requiresShipping
                  ? "Delivery is calculated at checkout for your area."
                  : "No delivery fee — digital services are delivered remotely."}
              </p>

              <div className="mt-4 grid gap-2">
                <Button asChild variant="brand" size="lg">
                  <Link to="/checkout" onClick={() => onOpenChange(false)}>
                    Proceed to checkout
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/cart" onClick={() => onOpenChange(false)}>
                    View full bag
                  </Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
