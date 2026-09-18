import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "citizen" | "authority" | "admin";

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  region: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  points: number;
  streak_days: number;
  onboarding_completed: boolean;
};

const GUEST_KEY = "roadpulse.guest";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  role: AppRole;
  loading: boolean;
  /** Browsing without an account: map + navigation only, no reporting. */
  isGuest: boolean;
  startGuest: () => void;
  endGuest: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function highestRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("authority")) return "authority";
  return "citizen";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(localStorage.getItem(GUEST_KEY) === "1");
  }, []);

  const startGuest = useCallback(() => {
    localStorage.setItem(GUEST_KEY, "1");
    setIsGuest(true);
  }, []);

  const endGuest = useCallback(() => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, bio, region, phone, city, state, points, streak_days, onboarding_completed",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((profileRow as Profile | null) ?? null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  }, []);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setRoles([]);
        return;
      }
      // Defer Supabase calls out of the auth callback to avoid deadlocks.
      setTimeout(() => {
        void loadUserData(nextSession.user.id);
      }, 0);
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadUserData(data.session.user.id);
      setLoading(false);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadUserData(session.user.id);
  }, [session, loadUserData]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      role: highestRole(roles),
      loading,
      isGuest,
      startGuest,
      endGuest,
      refreshProfile,
      signOut,
    }),
    [session, profile, roles, loading, isGuest, startGuest, endGuest, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
