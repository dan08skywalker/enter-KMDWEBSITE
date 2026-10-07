import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import type { PolicySection as PolicySectionShape } from "@/lib/site/content";

interface PolicyPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: readonly PolicySectionShape[];
}

/** Shared renderer for the privacy, terms and refund policy pages. */
export function PolicyPage({ eyebrow, title, intro, updated, sections }: PolicyPageProps) {
  return (
    <SiteShell>
      <PageHero eyebrow={eyebrow} title={title} intro={intro} />

      <Section>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Version {updated}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
          <nav aria-label="On this page" className="hidden lg:block">
            <p className="kmd-eyebrow text-muted-foreground">On this page</p>
            <ul className="mt-3 space-y-2">
              {sections.map((section, index) => (
                <li key={section.heading}>
                  <a
                    href={`#policy-${index}`}
                    className="text-xs text-muted-foreground hover:text-accent"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-8">
            {sections.map((section, index) => (
              <section key={section.heading} id={`policy-${index}`} className="kmd-panel p-6">
                <h2 className="text-base font-semibold">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </Section>
    </SiteShell>
  );
}
