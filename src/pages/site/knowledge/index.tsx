import { BookOpen, ExternalLink, Lightbulb, ShieldCheck, Truck, Wallet } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ShopCta } from "@/components/site/site-blocks";
import { DOKUDAMI_REVIEW_URL, KNOWLEDGE_GUIDES } from "@/lib/site/content";

const ICONS = [BookOpen, ShieldCheck, Wallet, Lightbulb, Truck];

export default function KnowledgePage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Knowledge centre"
        title="Understand the product before you buy it"
        intro="Short, plain-language guides on ingredients, how payment verification works, how the member plan settles, and how to choose the right product."
      >
        <nav aria-label="Guides" className="flex flex-wrap gap-2">
          {KNOWLEDGE_GUIDES.map((guide) => (
            <a
              key={guide.slug}
              href={`#${guide.slug}`}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-white/20"
            >
              {guide.title}
            </a>
          ))}
        </nav>
      </PageHero>

      <Section>
        <div className="space-y-6">
          {KNOWLEDGE_GUIDES.map((guide, index) => {
            const Icon = ICONS[index] ?? BookOpen;
            return (
              <article key={guide.slug} id={guide.slug} className="kmd-panel p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold tracking-tight">{guide.title}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {guide.summary}
                    </p>

                    <ul className="mt-4 space-y-2">
                      {guide.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                          {bullet}
                        </li>
                      ))}
                    </ul>

                    {guide.external ? (
                      <a
                        href={guide.external.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent underline underline-offset-2"
                      >
                        {guide.external.label}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="kmd-panel mt-8 p-6">
          <p className="kmd-eyebrow text-accent">Where the science reference comes from</p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            We link to the peer-reviewed review{" "}
            <a
              href={DOKUDAMI_REVIEW_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-accent underline underline-offset-2"
            >
              Pharmacological Effects of Houttuynia cordata
            </a>{" "}
            because it describes the botanical and its naturally occurring compounds in detail. It is
            educational reading. It is not evidence that a supplement can diagnose, treat, cure or
            prevent any disease, and it is not a claim about what any individual will experience.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <ShopCta />
      </Section>
    </SiteShell>
  );
}
