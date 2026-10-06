import { useState } from "react";
import { KeyRound, Loader2, LogOut, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { usePointRate } from "@/hooks/use-point-rate";
import { invokeFunction } from "@/lib/kmd/invoke";
import { PageHeader } from "@/components/kmd/page-header";
import { StatusBadge } from "@/components/kmd/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/kmd/format";
import { accountStatus } from "@/lib/kmd/labels";

export default function MemberSettings() {
  const { profile, roles, signOut, refreshProfile } = useAuth();
  const rate = usePointRate();
  const [mobile, setMobile] = useState(profile?.mobile_number ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const status = accountStatus(profile?.account_status);

  const saveProfile = async () => {
    setSavingProfile(true);
    const outcome = await invokeFunction<{ ok: boolean }>("member-actions", {
      action: "update_profile",
      mobile,
    });
    setSavingProfile(false);
    if (!outcome.ok) {
      toast.error("Could not save your details", { description: outcome.error });
      return;
    }
    toast.success("Details updated");
    await refreshProfile();
  };

  const changePassword = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
      toast.error("Password may contain letters and numbers only");
      return;
    }
    if (password !== confirm) {
      toast.error("Password and confirmation do not match");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);

    if (error) {
      console.error("Password change failed:", error.message);
      toast.error("Could not change your password", { description: error.message });
      return;
    }
    toast.success("Password changed");
    setPassword("");
    setConfirm("");
  };

  return (
    <>
      <PageHeader title="Settings" description="Your account details, security and session." />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Account</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only account information. Contact an administrator to change protected fields.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Member ID</dt>
              <dd className="font-mono">{profile?.member_code ?? "\u2014"}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono">{profile?.username ?? "\u2014"}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{profile?.email ?? "\u2014"}</dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Account status</dt>
              <dd>
                <StatusBadge label={status.label} tone={status.tone} />
              </dd>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Roles</dt>
              <dd className="text-right text-xs">{roles.length > 0 ? roles.join(", ") : "member"}</dd>
            </div>
          </dl>
        </div>

        <div className="kmd-panel p-5">
          <h2 className="text-sm font-semibold">Contact details</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-mobile">Mobile Number</Label>
              <Input
                id="settings-mobile"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                placeholder="09XX XXX XXXX"
              />
            </div>
            <Button onClick={() => void saveProfile()} disabled={savingProfile}>
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save details
            </Button>
          </div>

          <Separator className="my-5" />

          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Change password</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            At least 6 characters, letters and numbers only. You can also reset from the sign-in page.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-password">New password</Label>
              <Input
                id="settings-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-confirm">Confirm password</Label>
              <Input
                id="settings-confirm"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button variant="outline" onClick={() => void changePassword()} disabled={savingPassword}>
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Update password
            </Button>
          </div>
        </div>
      </div>

      <div className="kmd-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Point conversion rate</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            1 point = {formatPeso(1, rate)}. This rate is set by an administrator and drives every peso
            equivalent shown in your dashboard and redemption requests.
          </p>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );
}
