import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, Mail, MapPin, MessageSquare, Phone, Youtube } from "lucide-react";
import { PageHero, Section, SiteShell } from "@/components/site/site-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { COMPANY } from "@/lib/site/content";

const CATEGORIES = [
  { value: "general", label: "General enquiry" },
  { value: "order", label: "About an order" },
  { value: "payment", label: "Payment or verification" },
  { value: "delivery", label: "Delivery" },
  { value: "product", label: "A product question" },
  { value: "account", label: "My member account" },
  { value: "digital_service", label: "Website or landing page service" },
];

export default function ContactPage() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Almost there",
        description: "Add a subject and a message so we know how to help.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    const { data, error } = await supabase.rpc("kmd_ticket_create", {
      p_payload: {
        name: name.trim() || null,
        email: email.trim() || null,
        subject: subject.trim(),
        category,
        message: message.trim(),
      },
    });
    setSending(false);

    if (error) {
      console.error("Could not create the support ticket:", error.message);
      toast({
        title: "Message not sent",
        description: "Something went wrong at our end. Please try again or call us.",
        variant: "destructive",
      });
      return;
    }

    const result = (data ?? {}) as { status?: string; ticketNumber?: string; reasonText?: string };
    if (result.status === "FAILED") {
      toast({
        title: "Message not sent",
        description: result.reasonText ?? "Please check your details and try again.",
        variant: "destructive",
      });
      return;
    }

    setTicketNumber(result.ticketNumber ?? null);
    setSubject("");
    setMessage("");
    toast({
      title: "Message sent",
      description: result.reasonText ?? "Our team will reply during business hours.",
    });
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Contact us"
        title="Talk to the KMD Empire team"
        intro="Call, email or send us a message. If your question is about an order, include the order number and we will get to it faster."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="kmd-panel p-6">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Send us a message
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              This opens a support ticket. You do not need an account, and if you are signed in the
              ticket is linked to your member profile automatically.
            </p>

            {ticketNumber ? (
              <div className="mt-5 rounded-lg border border-success/30 bg-success/10 p-4">
                <p className="text-xs font-semibold">Your ticket number is {ticketNumber}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Keep this number handy. Our team replies during business hours.
                </p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contact-name">Your name</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email address</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="contact-subject">Subject</Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="How can we help?"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="contact-category">Topic</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="contact-category" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  placeholder="Tell us what you need. Include your order number if this is about an order."
                  className="mt-1.5"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="brand"
              size="lg"
              className="mt-5"
              disabled={sending}
              onClick={() => void submit()}
            >
              {sending ? "Sending…" : "Send message"}
            </Button>

            <p className="mt-3 text-[11px] text-muted-foreground">
              By sending this you agree we may contact you about your enquiry. See the{" "}
              <Link to="/privacy-policy" className="text-accent underline underline-offset-2">
                privacy policy
              </Link>
              .
            </p>
          </div>

          <aside className="space-y-4">
            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Direct lines</p>
              <ul className="mt-3 space-y-3">
                {COMPANY.phones.map((phone) => (
                  <li key={phone} className="flex items-center gap-2 text-xs">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-accent">
                      {phone}
                    </a>
                  </li>
                ))}
                {COMPANY.emails.map((email) => (
                  <li key={email} className="flex items-center gap-2 text-xs">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-gold" />
                    <a href={`mailto:${email}`} className="break-all hover:text-accent">
                      {email}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Where we are</p>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                Philippines · {COMPANY.legalParent}, with offices in the Philippines and Switzerland.
              </p>
              <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                Support is answered by a person. We reply on working days, and orders are verified in
                the order they arrive.
              </p>
            </div>

            <div className="kmd-panel p-5">
              <p className="kmd-eyebrow text-accent">Follow us</p>
              <div className="mt-3 flex gap-2">
                {[
                  { label: "Facebook", href: COMPANY.social.facebook, Icon: Facebook },
                  { label: "YouTube", href: COMPANY.social.youtube, Icon: Youtube },
                  { label: "Instagram", href: COMPANY.social.instagram, Icon: Instagram },
                ].map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {profile ? (
              <div className="kmd-panel p-5">
                <p className="kmd-eyebrow text-accent">Member support</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Signed in as {profile.full_name}. Your member support centre keeps every ticket and
                  reply in one place.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link to="/app/support">Open my support centre</Link>
                </Button>
              </div>
            ) : null}
          </aside>
        </div>
      </Section>
    </SiteShell>
  );
}
