import { useEffect, useState } from "react";
import { Loader2, Lock, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/kmd/format";
import { accountStatus, packageTier } from "@/lib/kmd/labels";

interface DetailRow {
  label: string;
  value: string;
  mono?: boolean;
}

export default function MemberProfile() {
  const { profile, refreshProfile, profileLoading } = useAuth();
  const [mobile, setMobile] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [packageName, setPackageName] = useState<string | null>(null);

  useEffect(() => {
    setMobile(profile?.mobile_number ?? "");
    setPhotoUrl(profile?.profile_photo_url ?? "");
  }, [profile]);

  useEffect(() => {
    if (!profile?.package_id) {
      setPackageName(null);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from("membership_packages")
        .select("name, tier")
        .eq("id", profile.package_id)
        .maybeSingle();
      if (error) {
        console.error("Could not load the membership package:", error.message);
        return;
      }
      if (active && data) setPackageName(data.name as string);
    })();
    return () => {
      active = false;
    };
  }, [profile?.package_id]);

  const status = accountStatus(profile?.account_status);

  const save = async () => {
    setSaving(true);
    const outcome = await invokeFunction<{ ok: boolean; message?: string }>("member-actions", {
      action: "update_profile",
      mobile,
      profilePhotoUrl: photoUrl,
    });
    setSaving(false);

    if (!outcome.ok) {
      toast.error("Could not save your profile", { description: outcome.error });
      return;
    }
    toast.success("Profile updated");
    await refreshProfile();
  };

  const rows: DetailRow[] = [
    { label: "Member ID", value: profile?.member_code ?? "\u2014", mono: true },
    { label: "Full Name", value: profile?.full_name ?? "\u2014" },
    { label: "Username", value: profile?.username ?? "\u2014", mono: true },
    { label: "Email Address", value: profile?.email ?? "\u2014" },
    { label: "Sponsor ID", value: profile?.sponsor_code ?? "No sponsor", mono: true },
    { label: "Referral Code", value: profile?.referral_code ?? "\u2014", mono: true },
    {
      label: "Membership Package",
      value: packageName ?? "No package yet",
    },
    { label: "Account Type", value: (profile?.account_type ?? "\u2014").toUpperCase() },
    { label: "Registration Date", value: formatDate(profile?.registration_date) },
    { label: "Activation Date", value: formatDate(profile?.activation_date) },
  ];

  return (
    <>
      <PageHeader
        title="My Profile"
        description="Your member record. Identification, sponsor placement and balances are protected fields."
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="kmd-panel">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold">Member record</h2>
              <p className="text-xs text-muted-foreground">
                Generated automatically at registration.
              </p>
            </div>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>

          {profileLoading && !profile ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <dl className="divide-y">
              {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className={row.mono ? "font-mono text-sm" : "text-sm"}>{row.value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Package Tier
                </dt>
                <dd>
                  {packageName ? (
                    <StatusBadge label={packageName} tone="gold" />
                  ) : (
                    <span className="text-sm text-muted-foreground">Not assigned</span>
                  )}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="space-y-6">
          <div className="kmd-panel p-5">
            <h2 className="text-sm font-semibold">Contact details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These are the only fields you can change yourself.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kmd-mobile">Mobile Number</Label>
                <Input
                  id="kmd-mobile"
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  placeholder="09XX XXX XXXX"
                  inputMode="tel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kmd-photo">Profile Photo URL</Label>
                <Input
                  id="kmd-photo"
                  value={photoUrl}
                  onChange={(event) => setPhotoUrl(event.target.value)}
                  placeholder="https://"
                />
              </div>
              <Button onClick={() => void save()} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </div>

          <div className="kmd-panel border-dashed p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Protected fields</h2>
            </div>
            <Separator className="my-3" />
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Member ID, referral code and username cannot be changed.
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Sponsor placement is locked after registration; only an administrator can change it,
                and every change is written to the audit log.
              </li>
              <li className="flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Point balances come from the ledger and are never edited directly.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
