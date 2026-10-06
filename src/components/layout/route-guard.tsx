import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

/** Requires a signed-in session; sends anonymous visitors to the sign-in page. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Restoring your session" />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/**
 * Requires administrator rights. The check uses the role rows loaded for this
 * session; every administrative backend function re-checks the same fact on the
 * server, so this is a convenience guard, not the security boundary.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, profileLoading, isAdmin, session, profile } = useAuth();

  if (loading || (session && profileLoading && !profile)) {
    return <FullPageLoader label="Checking your permissions" />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background p-6">
        <div className="kmd-panel max-w-md p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/12 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-lg font-semibold">Administrator access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have administrator rights. If you believe this is a
            mistake, ask a super administrator to grant your account the admin role.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link to="/app">Back to my dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
