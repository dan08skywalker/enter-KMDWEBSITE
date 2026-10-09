import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { LoginBrandPanel } from "@/components/auth/login-artwork";
import { SocialLinks } from "@/components/auth/social-links";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function Login() {
  const { signIn, session, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect target is unchanged: the page the member was sent here from, or /app.
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/app";

  useEffect(() => {
    if (!loading && session) navigate(redirectTo, { replace: true });
  }, [loading, session, navigate, redirectTo]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(username, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-kmd-surface px-3 py-6 sm:px-4 sm:py-10">
      <div className="kmd-login-card w-full max-w-5xl overflow-hidden rounded-3xl bg-card ring-1 ring-border">
        <div className="grid lg:grid-cols-2">
          {/* Branding: a compact band on small screens, the full nature panel on desktop. */}
          <LoginBrandPanel className="min-h-[13rem] lg:min-h-[38rem]" />

          <div className="relative flex flex-col px-5 py-8 sm:px-10 sm:py-10">
            <div className="mb-6 flex items-center justify-end gap-2">
              <LanguageSwitcher className="min-w-[8.5rem]" />
              <ThemeToggle />
            </div>

            <div className="mx-auto w-full max-w-md flex-1">
              <h1 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">
                {t("login.welcome")}
              </h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">{t("login.subtitle")}</p>

              <form onSubmit={submit} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">{t("login.username")}</Label>
                  <div className="relative">
                    <UserRound
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="login-username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      autoFocus
                      placeholder={t("login.usernamePlaceholder")}
                      className="h-11 pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("login.password")}</Label>
                  <div className="relative">
                    <Lock
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder={t("login.passwordPlaceholder")}
                      className="h-11 pl-10 pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Session persistence is fixed by the authentication client, which
                    always keeps the session on this device, so there is no switch to
                    offer here — the note states what actually happens. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">{t("login.sessionNote")}</p>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {t("login.forgot")}
                  </Link>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-xs font-medium text-destructive">{error}</p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  disabled={busy}
                  className="kmd-login-cta h-12 w-full text-sm font-bold text-white shadow-elegant transition-colors"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("login.signingIn")}
                    </>
                  ) : (
                    <>
                      {t("login.signIn")}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-7">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("login.followUs")}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <SocialLinks className="mt-3" />
              </div>

              <p className="mt-7 text-center text-sm text-muted-foreground">
                {t("login.noAccount")}{" "}
                <Link
                  to="/register"
                  className="font-bold text-primary underline-offset-4 hover:underline"
                >
                  {t("login.signUp")}
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom strip: only links to services that exist, with no unverified claims. */}
        <div className="kmd-login-strip px-5 py-3 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] text-white/85">
            <span className="font-semibold text-white">{t("login.help.title")}</span>
            <Link to="/faqs" className="underline-offset-4 hover:text-white hover:underline">
              {t("login.help.support")}
            </Link>
            <Link to="/contact" className="underline-offset-4 hover:text-white hover:underline">
              {t("login.help.contact")}
            </Link>
            <Link to="/track" className="underline-offset-4 hover:text-white hover:underline">
              {t("login.help.track")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
