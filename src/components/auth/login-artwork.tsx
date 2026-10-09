import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/** The supplied brand mark, used exactly as the site header uses it. */
export const KMD_LOGO_URL =
  "https://cdn.enter.pro/visual_resources/100617780/eadf183afe7f40ee8b1303e459f216e7/2452f3f9.png";

/**
 * Nature panel artwork.
 *
 * Drawn with gradients and simple leaf shapes rather than a bitmap, so it stays
 * sharp, loads instantly and never competes with the logo. Purely decorative.
 */
function Leaf({ className, opacity = 0.5 }: { className?: string; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={cn("pointer-events-none absolute", className)}
      style={{ opacity }}
    >
      <path
        d="M4 96C4 50 34 10 96 4c6 56-24 92-92 92z"
        fill="url(#kmdLeafGradient)"
        stroke="hsl(150 45% 30% / 0.35)"
        strokeWidth="0.8"
      />
      <path d="M8 92C34 62 62 34 92 12" stroke="hsl(150 50% 28% / 0.45)" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function DewDrops() {
  const drops = [
    { top: "18%", left: "26%", size: 8 },
    { top: "34%", left: "12%", size: 5 },
    { top: "62%", left: "20%", size: 6 },
    { top: "76%", left: "38%", size: 4 },
    { top: "12%", left: "56%", size: 5 },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {drops.map((drop) => (
        <span
          key={`${drop.top}-${drop.left}`}
          className="absolute rounded-full bg-white/70 ring-1 ring-white/60"
          style={{
            top: drop.top,
            left: drop.left,
            height: drop.size,
            width: drop.size,
            boxShadow: "0 1px 3px hsl(150 40% 30% / 0.35)",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Left branding panel: soft green leaves and light, the supplied KMD logo, the
 * GreenChoyce endorsement and the tagline, closed off by the curved dark-green
 * divider that separates it from the white sign-in panel.
 */
export function LoginBrandPanel({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn("kmd-login-panel relative overflow-hidden", className)}>
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          <linearGradient id="kmdLeafGradient" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(146 62% 34%)" />
            <stop offset="100%" stopColor="hsl(96 58% 52%)" />
          </linearGradient>
          <linearGradient id="kmdCurveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(152 65% 14%)" />
            <stop offset="100%" stopColor="hsl(150 55% 20%)" />
          </linearGradient>
        </defs>
      </svg>

      <Leaf className="-left-8 -top-10 h-40 w-40 rotate-[18deg]" opacity={0.45} />
      <Leaf className="-left-4 top-28 h-28 w-28 rotate-[64deg]" opacity={0.32} />
      <Leaf className="bottom-6 -right-6 h-40 w-40 rotate-[200deg]" opacity={0.4} />
      <Leaf className="-bottom-6 left-6 h-24 w-24 rotate-[130deg]" opacity={0.28} />
      <DewDrops />

      <div className="relative flex h-full flex-col items-center justify-center px-8 py-10 text-center lg:px-12">
        <img
          src={KMD_LOGO_URL}
          alt="KMD Empire"
          crossOrigin="anonymous"
          className="h-28 w-28 rounded-2xl object-contain mix-blend-multiply sm:h-32 sm:w-32 lg:h-40 lg:w-40"
        />

        <div className="mt-6 flex w-full max-w-xs items-center gap-3">
          <span className="h-px flex-1 bg-primary/25" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            {t("login.poweredBy")}
          </span>
          <span className="h-px flex-1 bg-primary/25" />
        </div>

        <p className="mt-2 text-xl font-extrabold tracking-tight text-primary">
          Green<span className="text-[hsl(96_62%_38%)]">Choyce</span>
        </p>

        <p className="mt-6 max-w-xs text-sm font-medium italic leading-relaxed text-primary/85">
          {t("login.brandTagline")}
        </p>
      </div>

      {/* Curved dark-green divider between the branding and the sign-in panel. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-[10%] lg:block"
      >
        <path d="M100 0 C34 26 34 74 100 100 L100 100 L100 0 Z" fill="url(#kmdCurveGradient)" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3 w-full lg:hidden"
      >
        <path d="M0 12 C30 2 70 2 100 12 L100 12 L0 12 Z" fill="url(#kmdCurveGradient)" />
      </svg>
    </div>
  );
}
