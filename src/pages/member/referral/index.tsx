import { useEffect, useState } from "react";
import { Check, Copy, Link2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { PageHeader } from "@/components/kmd/page-header";
import { StatCard } from "@/components/kmd/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MemberReferral() {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [directReferrals, setDirectReferrals] = useState<number | null>(null);
  const [totalTeam, setTotalTeam] = useState<number | null>(null);

  const referralCode = profile?.referral_code ?? "";
  const referralLink = referralCode
    ? `${window.location.origin}/register?ref=${referralCode}`
    : "";

  useEffect(() => {
    if (!user) return;
    let active = true;

    void (async () => {
      const [direct, all] = await Promise.all([
        supabase
          .from("sponsor_relationships")
          .select("*", { count: "exact", head: true })
          .eq("ancestor_id", user.id)
          .eq("level", 1),
        supabase
          .from("sponsor_relationships")
          .select("*", { count: "exact", head: true })
          .eq("ancestor_id", user.id),
      ]);

      if (direct.error) console.error("Could not count direct referrals:", direct.error.message);
      if (all.error) console.error("Could not count team members:", all.error.message);

      if (active) {
        setDirectReferrals(direct.count ?? 0);
        setTotalTeam(all.count ?? 0);
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const copy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Clipboard write failed:", error);
      toast.error("Could not copy automatically", {
        description: "Select the link and copy it manually.",
      });
    }
  };

  const share = async () => {
    if (!referralLink) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join KMD Empire",
          text: "Register with my KMD Empire referral link",
          url: referralLink,
        });
        return;
      } catch {
        // The user dismissed the share sheet; fall back to copying.
      }
    }
    await copy();
  };

  return (
    <>
      <PageHeader
        title="Referral Link"
        description="Share your link and every member who registers through it is placed under you as your direct Level 1."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Direct Referrals"
          value={directReferrals === null ? "\u2014" : String(directReferrals)}
          hint="Level 1 members"
          icon={Users}
          accent="gold"
        />
        <StatCard
          label="Total Team"
          value={totalTeam === null ? "\u2014" : String(totalTeam)}
          hint="Levels 1 to 5"
          icon={Share2}
          accent="primary"
        />
        <StatCard
          label="Referral Code"
          value={referralCode || "\u2014"}
          hint="Used in your referral link"
          accent="platinum"
        />
      </div>

      <div className="kmd-panel space-y-5 p-5">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Your referral link</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="referral-link">Referral Link</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="referral-link" readOnly value={referralLink} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button onClick={() => void copy()} className="sm:w-auto" disabled={!referralLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" onClick={() => void share()} disabled={!referralLink}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="kmd-label">Your Member ID</p>
            <p className="mt-1 font-mono text-sm">{profile?.member_code ?? "\u2014"}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="kmd-label">Your Referral Code</p>
            <p className="mt-1 font-mono text-sm">{referralCode || "\u2014"}</p>
          </div>
        </div>
      </div>

      <div className="kmd-panel border-dashed p-5">
        <h2 className="text-sm font-semibold">How your referral link works</h2>
        <ol className="mt-3 space-y-3 text-xs text-muted-foreground">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              1
            </span>
            The link carries your Sponsor ID in the <span className="font-mono">ref</span> parameter, and
            the registration form locks that sponsor in place.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              2
            </span>
            Registration creates a permanent sponsor relationship: the new member becomes your direct
            Level 1.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              3
            </span>
            When their purchase is qualified (payment confirmed), the reward engine traces Level 1 to
            Level 10 and posts the configured bonus to each eligible upline's ledger.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              4
            </span>
            No commission is generated by the order itself — only by a qualified purchase.
          </li>
        </ol>
      </div>
    </>
  );
}
