import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Coins,
  CreditCard,
  FileClock,
  Layers,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { StatusBadge } from "@/components/kmd/status-badge";
import { formatPeso } from "@/lib/kmd/format";
import { packageTier } from "@/lib/kmd/labels";
import { MEMBER_ID_FORMAT } from "@/lib/kmd/constants";

interface PackageCard {
  id: string;
  name: string;
  tier: string;
  productName: string | null;
  sku: string | null;
  price: number;
}

const CHAIN = [
  { title: "Buyer", detail: "A purchase is created and stored with its Product ID, SKU and quantity." },
  { title: "Level 1", detail: "The direct sponsor earns the configured Level 1 value." },
  { title: "Level 2", detail: "The sponsor's sponsor earns the Level 2 value." },
  { title: "Level 3", detail: "Traced automatically from the sponsor chain." },
  { title: "Level 4", detail: "Traced automatically from the sponsor chain." },
  { title: "Level 5", detail: "The fifth upline, and the end of the compensation trace." },
];

const VALUE_CARDS = [
  {
    icon: LockKeyhole,
    title: "An immutable point ledger",
    detail:
      "Every bonus is written as a ledger entry. History is never edited — corrections are posted as offsetting reversals.",
  },
  {
    icon: Sparkles,
    title: "A separate loyalty ledger",
    detail:
      "Loyalty Credits are tracked in their own ledger and balance, so they can never distort your unilevel points.",
  },
  {
    icon: FileClock,
    title: "Audited administration",
    detail:
      "Payment confirmations, activations, sponsor changes and compensation updates all land on an audit log.",
  },
];

export default function Landing() {
  const { session, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageCard[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("membership_packages")
        .select("id, name, tier, is_active, products(name, sku, selling_price)")
        .eq("is_active", true)
        .order("package_code");

      if (error) {
        console.error("Could not load the membership packages:", error.message);
        if (active) setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as Array<{
        id: string;
        name: string;
        tier: string;
        products: { name: string; sku: string; selling_price: number } | null;
      }>;

      if (active) {
        setPackages(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            tier: row.tier,
            productName: row.products?.name ?? null,
            sku: row.products?.sku ?? null,
            price: Number(row.products?.selling_price ?? 0),
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="kmd-brand-mark">KMD</span>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-bold tracking-tight">KMD EMPIRE</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Retailers &amp; Members
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <>
                {isAdmin ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin">Admin console</Link>
                  </Button>
                ) : null}
                <Button asChild size="sm">
                  <Link to="/app">My dashboard</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/register">Register Now</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-kmd-primary">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-24">
            <div className="text-primary-foreground">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                <Layers className="h-3.5 w-3.5" />
                Five-level unilevel compensation
              </span>

              <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                Professional Retailers &amp; Members Dashboard
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-primary-foreground/80 sm:text-base">
                KMD Empire tracks every qualified purchase through the sponsor chain, calculates each
                level's bonus from the configured matrix, and posts it to an auditable ledger. Your
                dashboard, point transactions, loyalty credits and shopping wallet all read from that
                same ledger.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {session ? (
                  <>
                    <Button asChild size="lg">
                      <Link to="/app">
                        Go to my dashboard
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    {isAdmin ? (
                      <Button
                        asChild
                        size="lg"
                        variant="outline"
                        className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                      >
                        <Link to="/admin">Admin console</Link>
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Button asChild size="lg">
                      <Link to="/register">
                        Register Now
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
                    >
                      <Link to="/login">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>

              <p className="mt-6 font-mono text-[11px] text-primary-foreground/60">
                Member ID format {MEMBER_ID_FORMAT}
              </p>
            </div>

            <div className="grid gap-4 self-center sm:grid-cols-2">
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 text-primary-foreground">
                <Coins className="h-5 w-5" />
                <p className="mt-3 text-sm font-semibold">Posted to a ledger</p>
                <p className="mt-1 text-[11px] text-primary-foreground/70">
                  Balances always agree with the ledger, and every entry carries an idempotency key so a
                  repeated confirmation cannot pay twice.
                </p>
              </div>
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-5 text-primary-foreground">
                <Users className="h-5 w-5" />
                <p className="mt-3 text-sm font-semibold">Real genealogy</p>
                <p className="mt-1 text-[11px] text-primary-foreground/70">
                  Your team tree is built from the Sponsor IDs recorded at registration — not from
                  hand-maintained lists.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            How the Unilevel plan works
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
            A purchase earns nothing on its own. Only when payment is confirmed does the reward engine
            trace upward and pay each eligible level.
          </p>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHAIN.map((step, index) => (
              <li key={step.title} className="kmd-panel p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kmd-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="mt-3 text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Compensation values are configured by the administrator for each product and level. Levels
            without a configured value simply create no ledger entry.
          </p>
        </section>

        <section className="border-y bg-muted/30 py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight">Membership packages</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Live from the catalogue. Confirming a package purchase issues the matching loyalty card.
            </p>

            {loading ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-40 w-full" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <p className="mt-8 text-sm text-muted-foreground">
                No membership package is published yet.
              </p>
            ) : (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {packages.map((pkg) => {
                  const tier = packageTier(pkg.tier);
                  return (
                    <div key={pkg.id} className="kmd-panel flex flex-col p-5">
                      <StatusBadge label={tier.label} tone={tier.tone} />
                      <p className="mt-3 text-sm font-semibold">{pkg.name}</p>
                      <p className="mt-1 flex-1 text-xs text-muted-foreground">
                        {pkg.productName ?? "Membership package"}
                      </p>
                      {pkg.sku ? (
                        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{pkg.sku}</p>
                      ) : null}
                      <p className="mt-3 text-lg font-bold">{formatPeso(pkg.price)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">Built on a real ledger</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {VALUE_CARDS.map((card) => (
              <div key={card.title} className="kmd-panel p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" />
                </span>
                <p className="mt-4 text-sm font-semibold">{card.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-kmd-primary py-14">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 text-center sm:px-6">
            <BadgeCheck className="h-8 w-8 text-primary-foreground" />
            <h2 className="text-2xl font-bold tracking-tight text-primary-foreground">
              Ready to start earning?
            </h2>
            <p className="max-w-xl text-sm text-primary-foreground/80">
              Create your member account in one step. If a sponsor shared their referral link with you,
              your placement is locked automatically.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/register">Register Now</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground"
              >
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <div className="flex items-center gap-2">
            <span className="kmd-brand-mark">KMD</span>
            <span className="text-sm font-bold tracking-tight">KMD EMPIRE</span>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground">{MEMBER_ID_FORMAT}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">
              Sign In
            </Link>
            <Link to="/register" className="hover:text-foreground">
              Register
            </Link>
            <span className="inline-flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Loyalty cards issued on confirmation
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Ledger-backed balances
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
