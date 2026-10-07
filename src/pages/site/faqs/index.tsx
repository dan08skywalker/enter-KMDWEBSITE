import { Link } from "react-router-dom";
import { HelpCircle, Mail, Phone } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { FaqAccordion } from "@/components/site/faq-accordion";
import { Button } from "@/components/ui/button";
import { FAQS, COMPANY } from "@/lib/site/content";

export default function FaqsPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="FAQs"
        title="Questions customers actually ask"
        intro="Ordering, payment verification, delivery, returns, supplements and the member plan — answered without the small print."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div>
            <FaqAccordion entries={FAQS} />
          </div>

          <aside className="space-y-4">
            <div className="kmd-panel p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <HelpCircle className="h-4 w-4 text-primary" />
                Still stuck?
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Send us a message and our team will reply during business hours. You can also open a
                support ticket from the link below.
              </p>
              <Button asChild variant="brand" size="sm" className="mt-4 w-full">
                <Link to="/contact">Contact support</Link>
              </Button>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Talk to us</p>
              <ul className="mt-3 space-y-2">
                {COMPANY.phones.map((phone) => (
                  <li key={phone} className="flex items-center gap-2 text-xs">
                    <Phone className="h-3.5 w-3.5 text-gold" />
                    <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-accent">
                      {phone}
                    </a>
                  </li>
                ))}
                {COMPANY.emails.map((email) => (
                  <li key={email} className="flex items-center gap-2 text-xs">
                    <Mail className="h-3.5 w-3.5 text-gold" />
                    <a href={`mailto:${email}`} className="break-all hover:text-accent">
                      {email}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Useful pages</p>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                <li>
                  <Link to="/track" className="hover:text-accent">
                    Track an order
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy" className="hover:text-accent">
                    Return &amp; refund policy
                  </Link>
                </li>
                <li>
                  <Link to="/privacy-policy" className="hover:text-accent">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="hover:text-accent">
                    Terms &amp; conditions
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </SiteShell>
  );
}
