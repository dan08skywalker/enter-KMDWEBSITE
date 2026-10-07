import { PolicyPage } from "@/components/site/policy-page";
import { PRIVACY_POLICY, REFUND_POLICY, TERMS } from "@/lib/site/content";

const VERSION = "2026-10-07";

export function PrivacyPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy policy"
      title="How we handle your information"
      intro="What we collect, why we collect it, who can see it, and how you can ask us to change it."
      updated={VERSION}
      sections={PRIVACY_POLICY}
    />
  );
}

export function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Terms & conditions"
      title="The terms you agree to when you order"
      intro="Pricing, payment, delivery, digital services and the member compensation plan in plain terms."
      updated={VERSION}
      sections={TERMS}
    />
  );
}

export function RefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Return & refund policy"
      title="Returns, replacements and refunds"
      intro="The 7-day window, what to send us, and the cases we cannot cover."
      updated={VERSION}
      sections={REFUND_POLICY}
    />
  );
}
