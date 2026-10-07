import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PASSWORD_HINT } from "@/lib/kmd/constants";

type Stage = "checking" | "ready" | "invalid" | "done";

/**
 * Set a new password.
 *
 * This is the second half of "Forgot Password?": the reset email brings the
 * member here with a short-lived recovery session, and this screen lets them
 * choose a new password through the authentication provider.
 *
 * The old password is never requested, never displayed and never read — the
 * provider replaces the credential and the application never sees it.
 *
 * The same rules are enforced here as at registration so one policy applies
 * everywhere a password can be set.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    // A reset link arrives either as a recovery marker in the URL or as a
    // PASSWORD_RECOVERY auth event once the client has consumed those tokens.
    const url = `${window.location.hash}${window.location.search}`;
    const hasRecoveryMarker = url.includes("type=recovery") || url.includes("error_description");

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setStage("ready");
      } else if (session && hasRecoveryMarker) {
        setStage("ready");
      }
    });

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionData.session) {
        // Either the recovery link was just consumed, or someone who is already
        // signed in is deliberately changing their password. Both may proceed:
        // updateUser can only ever affect the signed-in account.
        setStage("ready");
        return;
      }
      // No session yet. If a recovery marker is present, give the client a
      // moment to establish it before declaring the link dead.
      if (!hasRecoveryMarker) {
        setStage("invalid");
        return;
      }
      window.setTimeout(() => {
        if (active) setStage((current) => (current === "checking" ? "invalid" : current));
      }, 3000);
    })();

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      console.error("Password update failed:", updateError.message);
      setError(
        /session|expired|token/i.test(updateError.message)
          ? "This reset link has expired. Request a new one from the sign-in page."
          : "Your password could not be changed. Please request a new reset link.",
      );
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStage("done");
  };

  const card = (children: React.ReactNode) => (
    <div className="relative flex min-h-full items-center justify-center bg-kmd-surface px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="kmd-brand-mark">KMD</span>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">KMD EMPIRE</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Retailers &amp; Members
            </span>
          </span>
        </Link>
        <div className="kmd-panel p-6 shadow-elegant sm:p-8">{children}</div>
      </div>
    </div>
  );

  if (stage === "checking") {
    return card(
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking your reset link…
      </div>,
    );
  }

  if (stage === "invalid") {
    return card(
      <>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/12 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold tracking-tight">This reset link is not valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may have already been used, or it may have expired. Reset links are single-use and
          time-limited.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request a new reset link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Back to Sign In</Link>
          </Button>
        </div>
      </>,
    );
  }

  if (stage === "done") {
    return card(
      <>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/12 text-[hsl(var(--success))]">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold tracking-tight">Your password has been changed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are signed in with your new password. Use it the next time you sign in.
        </p>
        <div className="mt-6">
          <Button className="w-full" onClick={() => navigate(isAdmin ? "/admin" : "/app")}>
            Continue to my dashboard
          </Button>
        </div>
      </>,
    );
  }

  return card(
    <>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
        <KeyRound className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight">Set a new password</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Choose a new password for your account. Your existing password is never shown to anyone, and
        choosing a new one replaces it.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reset-new-password">New Password</Label>
          <div className="relative">
            <Input
              id="reset-new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Your new password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm-password">Confirm Password</Label>
          <Input
            id="reset-confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Repeat your new password"
            required
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs font-medium text-destructive">{error}</p>
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Save new password
        </Button>
      </form>

      <p className="mt-4 text-[11px] text-muted-foreground">{PASSWORD_HINT}</p>
    </>,
  );
}
