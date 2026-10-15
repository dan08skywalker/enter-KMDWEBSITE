import { Link } from "react-router-dom";
import { ArrowRight, Coins, Link2, LockKeyhole, Sparkles, UserPlus, Users } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { MEMBER_ID_FORMAT } from "@/lib/kmd/constants";

const STEPS = [
  {
    icon: UserPlus,
    title: "1. Register",
    detail:
      "Create your account in one step. If a member shared their referral link with you, open that link and your sponsor is filled in for you.",
  },
  {
    icon: LockKeyhole,
    title: "2. Your placement is locked",
    detail:
      "The Sponsor ID you register with is stored permanently. Placing you correctly is what keeps the whole plan honest, so it is not editable from the member side.",
  },
  {
    icon: Link2,
    title: "3. Share your own link",
    detail:
      "Every member gets a referral link and a Member ID in the format " +
      MEMBER_ID_FORMAT +
      ". Anyone who registers through your link is placed directly under you.",
  },
  {
    icon: Coins,
    title: "4. Earn when a purchase settles",
    detail:
      "When someone in your team buys and their payment is confirmed, the system traces upward from that purchase and pays each eligible level.",
  },
];

const LEVELS = [
  { level: 1, detail: "Your direct referrals." },
  { level: 2, detail: "The people your direct referrals brought in." },
  { level: 3, detail: "Traced automatically from the sponsor chain." },
  { level: 4, detail: "Traced automatically from the sponsor chain." },
  { level: 5, detail: "Traced automatically from the sponsor chain." },
  { level: 6, detail: "Traced automatically from the sponsor chain." },
  { level: 7, detail: "Traced automatically from the sponsor chain." },
  { level: 8, detail: "Traced automatically from the sponsor chain." },
  { level: 9, detail: "Traced automatically from the sponsor chain." },
  { level: 10, detail: "The tenth upline — the end of the compensation trace." },
];

export default function ReferralProgramPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Referral program"
        title="A ten-level Unilevel plan, written to a ledger"
        intro="The plan is deliberately simple: a purchase earns nothing until it is paid and confirmed, and once it is, the system traces upward through the registered sponsor chain and pays each eligible level."
      >
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="gold" size="lg">
            <Link to="/register">
              Create my account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="hero-outline" size="lg">
            <Link to="/packages">See packages</Link>
          </Button>
        </div>
      </PageHero>

      <Section title="How it works">
        <div className="grid gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <div key={step.title} className="kmd-panel flex gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <step.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted" title="The ten levels">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LEVELS.map((row) => (
            <li key={row.level} className="kmd-panel p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kmd-primary text-xs font-bold text-primary-foreground">
                {row.level}
              </span>
              <p className="mt-3 text-xs font-semibold">Level {row.level}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{row.detail}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="How your earnings are protected">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="kmd-panel p-5">
            <Coins className="h-5 w-5 text-gold" />
            <p className="mt-3 text-sm font-semibold">Earned only on verified payment</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              An order that is placed but not paid produces no ledger entry at all. Only a confirmed
              payment qualifies.
            </p>
          </div>
          <div className="kmd-panel p-5">
            <LockKeyhole className="h-5 w-5 text-gold" />
            <p className="mt-3 text-sm font-semibold">Paid exactly once</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Every bonus carries an idempotency key. Confirming the same payment twice can never pay
              a level twice, and a mistake is fixed by posting an offsetting reversal — history is
              never edited.
            </p>
          </div>
          <div className="kmd-panel p-5">
            <Sparkles className="h-5 w-5 text-gold" />
            <p className="mt-3 text-sm font-semibold">Balances match the ledger</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              What you see in your dashboard is derived from the ledger itself, so the balance and
              the history can never disagree.
            </p>
          </div>
        </div>

        <div className="kmd-brand-tile mt-8">
          <div className="kmd-gold-rule" />
          <h3 className="mt-4 text-lg font-bold">Start your team today</h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/80">
            Registration takes a moment. If you were referred, use the link you were given so your
            sponsor is recorded correctly from the very first purchase.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="gold">
              <Link to="/register">Register now</Link>
            </Button>
            <Button asChild variant="hero-outline" size="sm">
              <Link to="/faqs">Read the FAQs</Link>
            </Button>
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
