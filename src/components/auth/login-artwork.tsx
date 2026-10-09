import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The supplied sign-in cover: dew-lit leaves, soft light and the KMD lockup with
 * the GreenChoyce endorsement, closed by the curved dark-green divider.
 *
 * Served as an optimised WebP (38 KB instead of the 1.05 MB original) so the
 * sign-in screen paints quickly, and drawn behind the tagline rather than as a
 * decorative background-image so the browser can prioritise it.
 */
export const LOGIN_COVER_SRC = "/login-cover.webp";

/**
 * Branding panel: the cover artwork, with the tagline on a translucent strip so it
 * stays readable over the leaves on every viewport.
 */
export function LoginBrandPanel({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <div className={cn("relative overflow-hidden bg-[hsl(140_45%_96%)]", className)}>
      <img
        src={LOGIN_COVER_SRC}
        alt=""
        aria-hidden="true"
        width={1200}
        height={800}
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-left"
      />

      <div className="absolute inset-x-0 bottom-0 bg-white/85 px-4 py-2 backdrop-blur-[2px]">
        <p className="mx-auto max-w-sm text-center text-[11px] font-medium italic leading-snug text-primary sm:text-xs">
          {t("login.brandTagline")}
        </p>
      </div>
    </div>
  );
}
