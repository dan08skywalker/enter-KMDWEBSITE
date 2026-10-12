import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  Coins,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { COMPANY } from "@/lib/site/content";
import { useSiteText } from "@/contexts/store-context";

/** Admin-published announcement strip. An empty setting hides it entirely. */
export function AnnouncementBar() {
  const announcement = useSiteText("site.announcement", "");

  if (!announcement) return null;

  return (
    <div className="bg-kmd-primary">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center sm:px-6">
        <p className="text-[11px] font-semibold tracking-wide text-primary-foreground sm:text-xs">
          {announcement}
        </p>
      </div>
    </div>
  );
}

/** Trust strip reused under the hero and on the cart and checkout pages. */
export function TrustStrip({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  // Each signal is listed explicitly so every key stays a literal the reporting
  // can resolve; the English wording matches the published copy exactly.
  const signals = [
    { Icon: CheckCircle2, title: t("home.trust.verifiedPayments"), detail: t("home.trust.verifiedPaymentsDetail") },
    { Icon: Truck, title: t("home.trust.realStock"), detail: t("home.trust.realStockDetail") },
    { Icon: Coins, title: t("home.trust.ledgerRewards"), detail: t("home.trust.ledgerRewardsDetail") },
    { Icon: ShieldCheck, title: t("home.trust.nationwide"), detail: t("home.trust.nationwideDetail") },
  ];

  return (
    <ul className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {signals.map((signal) => (
        <li key={signal.title} className="kmd-panel flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <signal.Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold">{signal.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{signal.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Brand story block used on the homepage and the About page. */
export function BrandTile() {
  const { t } = useTranslation();
  return (
    <div className="kmd-brand-tile">
      <div className="kmd-gold-rule" />
      <p className="kmd-eyebrow mt-4 text-gold">{COMPANY.legalParent}</p>
      <h3 className="mt-2 text-lg font-bold">{t("home.brand.tileTagline")}</h3>
      <p className="mt-2 text-xs leading-relaxed text-white/80">{t("home.brand.tileBlurb")}</p>
    </div>
  );
}

/** Inline CTA used at the end of content pages. */
export function ShopCta() {
  const { t } = useTranslation();
  return (
    <div className="kmd-hero rounded-2xl px-6 py-10 text-center sm:px-10">
      <h2 className="text-xl font-bold text-white sm:text-2xl">{t("cta.readyToOrder")}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">{t("cta.readyToOrderDetail")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          to="/shop"
          className="inline-flex h-11 items-center justify-center rounded-md bg-gold px-6 text-sm font-semibold text-gold-foreground shadow-[var(--shadow-gold)]"
        >
          {t("cta.shopAllProducts")}
        </Link>
        <Link
          to="/register"
          className="inline-flex h-11 items-center justify-center rounded-md border border-white/35 bg-white/12 px-6 text-sm font-semibold text-white hover:bg-white/22"
        >
          {t("cta.becomeMember")}
        </Link>
      </div>
    </div>
  );
}
