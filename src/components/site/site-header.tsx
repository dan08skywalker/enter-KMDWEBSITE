import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, ShoppingBag, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CartDrawer } from "@/components/site/cart-drawer";
import { AnnouncementBar } from "@/components/site/site-blocks";
import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Products", to: "/products" },
  { label: "Shop", to: "/shop" },
  { label: "Membership", to: "/packages" },
  { label: "Testimonials", to: "/testimonials" },
  { label: "FAQs", to: "/faqs" },
  { label: "Learn", to: "/knowledge" },
  { label: "News", to: "/blog" },
  { label: "Contact", to: "/contact" },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src="/brand/kmd-logo.png"
        alt=""
        crossOrigin="anonymous"
        className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain ring-1 ring-gold/40 sm:h-11 sm:w-11"
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="whitespace-nowrap text-sm font-bold tracking-tight">KMD EMPIRE</span>
        <span className="hidden whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:block">
          Health · Home · Everyday
        </span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const { session, isAdmin } = useAuth();
  const cart = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const accountLink = session ? (isAdmin ? "/admin" : "/app") : "/login";
  const accountLabel = session ? (isAdmin ? "Admin console" : "My dashboard") : "Member area";

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Brand />

          <nav className="ml-4 hidden flex-1 items-center gap-0.5 xl:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="hidden lg:block">
              <LanguageSwitcher className="h-9 min-w-[118px] text-xs" />
            </div>
            <ThemeToggle />

            {/* The shopping bag and the member/sign-in action stay reachable at
                every width, including the smallest phones. */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative"
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Bag</span>
              {cart.count > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                  {cart.count}
                </span>
              ) : null}
            </Button>

            <Button asChild variant="brand" size="sm">
              <Link to={accountLink}>
                <UserRound className="h-4 w-4" />
                <span className="hidden sm:inline">{accountLabel}</span>
                <span className="sm:hidden">Account</span>
              </Link>
            </Button>

            {!session ? (
              <Button asChild variant="gold" size="sm" className="hidden md:inline-flex">
                <Link to="/register">Register</Link>
              </Button>
            ) : null}

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[86vw] max-w-sm overflow-y-auto">
                <SheetTitle className="sr-only">Site menu</SheetTitle>
                <nav className="mt-6 flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "rounded-lg px-3 py-2.5 text-sm font-medium",
                          isActive
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>

                <div className="mt-6 flex flex-col gap-3 border-t pt-5">
                  <LanguageSwitcher />
                  <Button asChild variant="brand">
                    <Link to={accountLink} onClick={() => setMenuOpen(false)}>
                      {accountLabel}
                    </Link>
                  </Button>
                  {!session ? (
                    <Button asChild variant="gold">
                      <Link to="/register" onClick={() => setMenuOpen(false)}>
                        Register now
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline">
                    <Link to="/track" onClick={() => setMenuOpen(false)}>
                      Track an order
                    </Link>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
