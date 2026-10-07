import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);

    // The recovery link must land on the screen that can actually set a new
    // password; pointing it at /login left the member signed in with no way to
    // choose a new password.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setBusy(false);
    if (error) {
      // Never reveal whether the address exists; log for diagnostics only.
      console.error("Password reset request failed:", error.message);
    }
    setSent(true);
  };

  return (
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

        <div className="kmd-panel p-6 shadow-elegant sm:p-8">
          {sent ? (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/12 text-[hsl(var(--success))]">
                <MailCheck className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-lg font-bold tracking-tight">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If that email address is registered, a password reset link has been sent to it. Open the
                link to choose a new password.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Nothing arrived? Confirm you used the email address on your member record, then try
                again.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/login">Back to Sign In</Link>
                </Button>
                <Button variant="ghost" onClick={() => setSent(false)}>
                  Use a different email address
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight">Forgot Password</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the email address registered on your member record and we will send a secure reset
                link.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Registered Email Address</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send reset link
                </Button>
              </form>

              <p className="mt-5 border-t pt-5 text-center text-xs text-muted-foreground">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
