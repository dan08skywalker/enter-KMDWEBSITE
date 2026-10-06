import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Check,
  Copy,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PASSWORD_HINT } from "@/lib/kmd/constants";

interface SponsorPreview {
  found: boolean;
  memberCode?: string;
  displayName?: string;
}

interface RegistrationResult {
  ok?: boolean;
  memberCode?: string;
  referralCode?: string;
  referralLink?: string;
  sponsorName?: string | null;
  sponsorMemberCode?: string | null;
  accountStatus?: string;
  bootstrapAdmin?: boolean;
}

type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid";

export default function Register() {
  const [params] = useSearchParams();
  const referralCode = (params.get("ref") ?? "").trim();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [sponsorCode, setSponsorCode] = useState(referralCode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [sponsor, setSponsor] = useState<SponsorPreview | null>(null);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Resolve the referral link so the sponsor is shown and locked.
  useEffect(() => {
    if (!referralCode) return;
    let active = true;
    setSponsorLoading(true);

    void (async () => {
      const { data, error: lookupError } = await supabase.functions.invoke("account-lookup", {
        body: { action: "sponsor_preview", code: referralCode },
        headers: { "Content-Type": "application/json" },
      });

      if (lookupError) {
        console.error("Could not resolve the referral link:", lookupError.message);
      }
      if (active) {
        setSponsor((data as SponsorPreview | null) ?? { found: false });
        setSponsorLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [referralCode]);

  const sponsorLocked = Boolean(referralCode && sponsor?.found);

  const checkUsername = useCallback(async () => {
    const value = username.trim();
    if (value.length < 3) {
      setUsernameState(value.length === 0 ? "idle" : "invalid");
      return;
    }

    setUsernameState("checking");
    const { data, error: lookupError } = await supabase.functions.invoke("account-lookup", {
      body: { action: "check_username", username: value },
      headers: { "Content-Type": "application/json" },
    });

    if (lookupError) {
      console.error("Username check failed:", lookupError.message);
      setUsernameState("idle");
      return;
    }

    const payload = data as { available?: boolean; reason?: string } | null;
    if (payload?.reason === "INVALID_FORMAT") {
      setUsernameState("invalid");
      return;
    }
    setUsernameState(payload?.available === true ? "available" : "taken");
  }, [username]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (usernameState === "taken") {
      setError("That username is already taken.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!/^[A-Za-z0-9]+$/.test(password)) {
      setError("Password may contain letters and numbers only.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }

    setBusy(true);
    const { data, error: invokeError } = await supabase.functions.invoke("register-member", {
      body: {
        firstName,
        lastName,
        mobile,
        email,
        username,
        password,
        confirmPassword,
        sponsorCode,
      },
      headers: { "Content-Type": "application/json" },
    });
    setBusy(false);

    if (invokeError) {
      console.error("Registration request failed:", invokeError.message);
      setError("Could not reach the registration service. Please try again.");
      return;
    }

    const payload = data as RegistrationResult & { error?: string; message?: string };
    if (payload?.error) {
      setError(payload.message ?? "Registration could not be completed.");
      return;
    }
    setResult(payload);
  };

  const copyReferral = async () => {
    if (!result?.referralLink) return;
    const link = `${window.location.origin}${result.referralLink}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error("Clipboard write failed:", copyError);
    }
  };

  return (
    <div className="relative min-h-full bg-kmd-surface px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="kmd-brand-mark">KMD</span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">KMD EMPIRE</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Retailers &amp; Members
            </span>
          </span>
        </Link>

        {result?.memberCode ? (
          <div className="kmd-panel p-6 shadow-elegant sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/12 text-[hsl(var(--success))]">
                <BadgeCheck className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight">Registration complete</h1>
                <p className="text-xs text-muted-foreground">
                  Your member account has been created.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border bg-muted/40 p-5 text-center">
              <p className="kmd-label">Your Member ID</p>
              <p className="mt-2 font-mono text-xl font-bold tracking-tight">{result.memberCode}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Keep this ID. It identifies you in every transaction and ledger entry.
              </p>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Account status</dt>
                <dd className="font-medium">Pending activation</dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Sponsor</dt>
                <dd className="font-medium">
                  {result.sponsorName ?? "No sponsor"}
                  {result.sponsorMemberCode ? (
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                      {result.sponsorMemberCode}
                    </span>
                  ) : null}
                </dd>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Referral code</dt>
                <dd className="font-mono text-xs">{result.referralCode}</dd>
              </div>
            </dl>

            {result.bootstrapAdmin ? (
              <div className="mt-5 rounded-lg border border-gold/40 bg-gold/8 px-3 py-2">
                <p className="flex items-start gap-2 text-xs">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--gold))]" />
                  This is the first account on the system, so it was granted the super administrator
                  role. You can access the admin console after signing in.
                </p>
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              <p className="kmd-label">Your referral link</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}${result.referralLink ?? ""}`}
                  className="font-mono text-xs"
                />
                <Button variant="outline" onClick={() => void copyReferral()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Anyone who registers through this link is placed under you as your direct Level 1.
              </p>
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              Your account is pending activation. An administrator activates membership, and only
              qualified purchases generate commissions.
            </p>

            <Button asChild className="mt-6 w-full">
              <Link to="/login">Go to Sign In</Link>
            </Button>
          </div>
        ) : (
          <div className="kmd-panel p-6 shadow-elegant sm:p-8">
            <h1 className="text-xl font-bold tracking-tight">Create your member account</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Complete the form below. Your Member ID is generated automatically.
            </p>

            {referralCode ? (
              <div className="mt-5 rounded-lg border bg-muted/40 px-3 py-2.5">
                {sponsorLoading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Checking the referral link
                  </p>
                ) : sponsor?.found ? (
                  <p className="flex items-start gap-2 text-xs">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
                    <span>
                      Referred by <span className="font-semibold">{sponsor.displayName}</span>{" "}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {sponsor.memberCode}
                      </span>
                      . This sponsor is locked to keep your unilevel placement correct.
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    That referral link is not valid. You can type a Sponsor ID manually.
                  </p>
                )}
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-first">First Name</Label>
                  <Input
                    id="register-first"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-last">Last Name</Label>
                  <Input
                    id="register-last"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-mobile">Mobile Number</Label>
                  <Input
                    id="register-mobile"
                    value={mobile}
                    onChange={(event) => setMobile(event.target.value)}
                    inputMode="tel"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email Address</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-sponsor">Sponsor ID</Label>
                <Input
                  id="register-sponsor"
                  value={sponsorCode}
                  onChange={(event) => setSponsorCode(event.target.value)}
                  readOnly={sponsorLocked}
                  disabled={sponsorLocked}
                  placeholder="KMD-0000-0000-0000-0000"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  {sponsorLocked
                    ? "Locked from your referral link."
                    : "Optional. Your sponsor earns from your qualified purchases."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-username">Username</Label>
                <div className="relative">
                  <Input
                    id="register-username"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setUsernameState("idle");
                    }}
                    onBlur={() => void checkUsername()}
                    autoComplete="username"
                    autoCapitalize="none"
                    required
                    className="pr-24"
                  />
                  <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[11px] font-medium">
                    {usernameState === "checking" ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground">Checking</span>
                      </>
                    ) : null}
                    {usernameState === "available" ? (
                      <>
                        <Check className="h-3 w-3 text-[hsl(var(--success))]" />
                        <span className="text-[hsl(var(--success))]">Available</span>
                      </>
                    ) : null}
                    {usernameState === "taken" ? (
                      <>
                        <X className="h-3 w-3 text-destructive" />
                        <span className="text-destructive">Already taken</span>
                      </>
                    ) : null}
                    {usernameState === "invalid" ? (
                      <span className="text-destructive">3-32 characters</span>
                    ) : null}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-confirm">Confirm Password</Label>
                  <Input
                    id="register-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">{PASSWORD_HINT}</p>

              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <p className="text-xs font-medium text-destructive">{error}</p>
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                Create my account
              </Button>
            </form>

            <p className="mt-5 border-t pt-5 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
