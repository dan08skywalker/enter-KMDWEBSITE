import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

/** Layout shared by every public page: header, page body, footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}

/** Compact dark banner used at the top of every interior public page. */
export function PageHero({ eyebrow, title, intro, children }: PageHeroProps) {
  return (
    <section className="kmd-hero">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="kmd-gold-rule" />
        {eyebrow ? <p className="kmd-eyebrow mt-4 text-gold">{eyebrow}</p> : null}
        <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        {intro ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80">{intro}</p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </section>
  );
}

interface SectionProps {
  title?: string;
  intro?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
}

export function Section({ title, intro, children, className = "", tone = "default" }: SectionProps) {
  return (
    <section className={tone === "muted" ? "border-y bg-muted/40" : ""}>
      <div className={`mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 ${className}`}>
        {title ? (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            {intro ? <p className="mt-2 text-sm text-muted-foreground">{intro}</p> : null}
          </div>
        ) : null}
        <div className={title ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}
