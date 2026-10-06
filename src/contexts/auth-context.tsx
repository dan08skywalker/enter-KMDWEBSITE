import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserRole } from "@/lib/kmd/types";

interface SignInResult {
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRetailer: boolean;
  loading: boolean;
  profileLoading: boolean;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    setProfileLoading(true);
    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      if (profileResult.error) {
        console.error("Could not load the member record:", profileResult.error.message);
      }
      if (rolesResult.error) {
        console.error("Could not load member roles:", rolesResult.error.message);
      }

      setProfile((profileResult.data as Profile | null) ?? null);
      setRoles(((rolesResult.data ?? []) as Array<{ role: UserRole }>).map((row) => row.role));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    // The listener is registered BEFORE the session restore so the initial
    // session event is never missed.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Any client call inside this callback must be deferred, otherwise the
        // auth client deadlocks.
        const userId = nextSession.user.id;
        setTimeout(() => {
          void loadProfile(userId);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session ?? null);
      setUser(sessionData.session?.user ?? null);
      if (sessionData.session?.user) {
        await loadProfile(sessionData.session.user.id);
      }
      setLoading(false);
    })();

    return () => data.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (username: string, password: string): Promise<SignInResult> => {
    const cleaned = username.trim();
    if (!cleaned) return { error: "Enter your username." };
    if (!password) return { error: "Enter your password." };

    const { data, error } = await supabase.functions.invoke("account-lookup", {
      body: { action: "resolve_login", username: cleaned },
      headers: { "Content-Type": "application/json" },
    });

    if (error) {
      console.error("Sign-in lookup failed:", error.message);
      return { error: "Could not reach the sign-in service. Please try again." };
    }
    if (!data?.found) {
      return { error: "That username was not found." };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email as string,
      password,
    });

    if (signInError) {
      console.error("Sign-in failed:", signInError.message);
      if (/invalid/i.test(signInError.message)) return { error: "Incorrect password." };
      return { error: signInError.message };
    }

    return {};
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign-out failed:", error.message);
    setProfile(null);
    setRoles([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = roles.includes("admin") || roles.includes("super_admin");
    return {
      user,
      session,
      profile,
      roles,
      isAdmin,
      isSuperAdmin: roles.includes("super_admin"),
      isRetailer: roles.includes("retailer") || profile?.account_type === "retailer",
      loading,
      profileLoading,
      signIn,
      signOut,
      refreshProfile,
    };
  }, [user, session, profile, roles, loading, profileLoading, signIn, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
