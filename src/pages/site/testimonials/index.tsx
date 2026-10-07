import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { ShopCta } from "@/components/site/site-blocks";
import { TestimonialGrid } from "@/components/site/testimonial-card";

export default function TestimonialsPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Testimonials"
        title="What our customers say"
        intro="Honest words from customers and clients, published as they were given to us."
      />

      <Section>
        <TestimonialGrid />

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="kmd-panel p-6">
            <p className="kmd-eyebrow text-accent">How we publish testimonials</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              We publish the testimonial the customer gave us, with their name and the product they
              are talking about. We do not edit a review to imply an outcome it does not claim.
            </p>
          </div>

          <div className="kmd-panel p-6">
            <p className="kmd-eyebrow text-accent">What we do not publish</p>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              We do not promote testimonials that describe the outcome of a disease. Our supplement
              products are food supplements: they are not intended to diagnose, treat, cure or
              prevent any disease, and a personal health story is not evidence that they do. Any
              claim like that is left off this site deliberately.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          Testimonials describe individual experiences and are not a promise of the results you will
          get.
        </p>
      </Section>

      <Section className="pt-0">
        <ShopCta />
      </Section>
    </SiteShell>
  );
}
