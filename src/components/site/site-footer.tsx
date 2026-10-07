import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { COMPANY } from "@/lib/site/content";
import { useSiteList, useSiteText } from "@/contexts/store-context";
import { MEMBER_ID_FORMAT } from "@/lib/kmd/constants";

const QUICK_LINKS = [
  { label: "Home", to: "/" },
  { label: "About Us", to: "/about" },
  { label: "Products", to: "/products" },
  { label: "Shop", to: "/shop" },
  { label: "Membership", to: "/packages" },
  { label: "Referral Program", to: "/referral-program" },
  { label: "Testimonials", to: "/testimonials" },
  { label: "FAQs", to: "/faqs" },
] as const;

const HELPFUL_LINKS = [
  { label: "Knowledge Centre", to: "/knowledge" },
  { label: "News & Updates", to: "/blog" },
  { label: "Announcements", to: "/announcements" },
  { label: "Track an Order", to: "/track" },
  { label: "Contact Us", to: "/contact" },
  { label: "Support", to: "/contact" },
] as const;

const POLICY_LINKS = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Return & Refund Policy", to: "/refund-policy" },
] as const;

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.5 3h-2.6v11.2a2.6 2.6 0 1 1-2.2-2.57V9a5.2 5.2 0 1 0 4.8 5.18V8.1a6.4 6.4 0 0 0 3.5 1.06V6.6a3.7 3.7 0 0 1-3.5-3.6Z" />
    </svg>
  );
}

export function SiteFooter() {
  const phones = useSiteList("site.contact.phones", [...COMPANY.phones]);
  const emails = useSiteList("site.contact.emails", [...COMPANY.emails]);
  const tagline = useSiteText("site.tagline", COMPANY.tagline);
  const website = useSiteText("site.website", COMPANY.website);

  const socials = [
    { label: "Facebook", href: useSiteText("site.social.facebook", COMPANY.social.facebook), Icon: Facebook },
    { label: "YouTube", href: useSiteText("site.social.youtube", COMPANY.social.youtube), Icon: Youtube },
    { label: "TikTok", href: useSiteText("site.social.tiktok", COMPANY.social.tiktok), Icon: TikTokIcon },
    { label: "Instagram", href: useSiteText("site.social.instagram", COMPANY.social.instagram), Icon: Instagram },
  ];

  return (
    <footer className="border-t bg-kmd-hero text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src="/brand/kmd-logo.png"
              alt=""
              crossOrigin="anonymous"
              className="h-12 w-12 rounded-lg bg-white object-contain ring-1 ring-gold/40"
            />
            <span className="flex flex-col leading-none">
              <span className="font-display text-base font-bold tracking-tight">
                {COMPANY.name}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">
                {website}
              </span>
            </span>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-white/75">{tagline}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/55">{COMPANY.poweredBy}</p>

          <div className="mt-5 flex gap-2">
            {socials.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="kmd-eyebrow text-gold">Quick links</p>
          <ul className="mt-4 space-y-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.to + link.label}>
                <Link to={link.to} className="text-xs text-white/75 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="kmd-eyebrow text-gold">Help &amp; policies</p>
          <ul className="mt-4 space-y-2">
            {[...HELPFUL_LINKS, ...POLICY_LINKS].map((link) => (
              <li key={link.to + link.label}>
                <Link to={link.to} className="text-xs text-white/75 hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="kmd-eyebrow text-gold">Contact us</p>
          <ul className="mt-4 space-y-3">
            {phones.map((phone) => (
              <li key={phone} className="flex items-start gap-2 text-xs text-white/75">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-white">
                  {phone}
                </a>
              </li>
            ))}
            {emails.map((email) => (
              <li key={email} className="flex items-start gap-2 text-xs text-white/75">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                <a href={`mailto:${email}`} className="break-all hover:text-white">
                  {email}
                </a>
              </li>
            ))}
            <li className="flex items-start gap-2 text-xs text-white/75">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              Philippines · registered with {COMPANY.legalParent}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/12">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-center sm:px-6 md:flex-row md:text-left">
          <p className="text-[11px] text-white/55">
            &copy; {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </p>
          <p className="text-[11px] text-white/45">
            Member IDs use the format <span className="font-mono">{MEMBER_ID_FORMAT}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
