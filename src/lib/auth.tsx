import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { isSupabaseConfigured, supabase } from "./supabase";
import type { Profile } from "./types";

interface AuthValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  configured: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

const PROFILE_COLUMNS = "id, username, display_name, avatar_url, bio, location, created_at";

/** Postgres / PostgREST codes that mean "the tables or functions are not installed". */
const MISSING_SCHEMA_CODES = new Set(["42P01", "42883", "PGRST205", "PGRST202"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const loadedFor = useRef<string | null>(null);
  const warnedSchema = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();

    if (!error && data) {
      loadedFor.current = userId;
      setProfile(data as Profile);
      return;
    }

    // No profile row yet (for example the account pre-dates the database setup,
    // or the sign-up trigger could not run): create it now.
    const created = await supabase.rpc("ensure_my_profile");
    if (!created.error && created.data) {
      loadedFor.current = userId;
      setProfile(created.data as Profile);
      return;
    }

    setProfile(null);
    const failure = created.error ?? error;
    if (failure) {
      console.warn("[Snap & Sell] Could not load or create the profile:", failure.message);
      if (MISSING_SCHEMA_CODES.has(failure.code ?? "") && !warnedSchema.current) {
        warnedSchema.current = true;
        toast.error(
          "Your database isn't set up yet. Run supabase/schema.sql in the Supabase SQL editor, then reload.",
          { duration: 12000 },
        );
      }
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (next?.user) {
        const userId = next.user.id;
        // Don't re-fetch on every silent token refresh.
        if (event === "TOKEN_REFRESHED" && loadedFor.current === userId) return;
        // Defer: calling Supabase from inside this callback can deadlock the auth lock.
        window.setTimeout(() => {
          if (active) void loadProfile(userId);
        }, 0);
      } else {
        loadedFor.current = null;
        setProfile(null);
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession((current) => current ?? data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    loadedFor.current = null;
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        loading,
        configured: isSupabaseConfigured,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
