import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const isBrowser = typeof window !== "undefined";

const clean = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const rawUrl = clean(import.meta.env["VITE_SUPABASE_URL"])?.replace(/\/+$/, "");
const rawKey = clean(
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_ANON_KEY"],
);

/** A secret / service-role key must never be shipped to the browser. */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    const json = atob((parts[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: string }).role === "service_role";
  } catch {
    return false;
  }
}

function findConfigProblem(): string | null {
  if (!rawUrl && !rawKey) return null; // simply not connected yet → demo mode
  if (!rawUrl) return "VITE_SUPABASE_URL is missing.";
  if (!rawKey) return "VITE_SUPABASE_PUBLISHABLE_KEY is missing.";
  if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(rawUrl) && !/^https?:\/\/localhost/i.test(rawUrl)) {
    return "VITE_SUPABASE_URL must look like https://your-project-ref.supabase.co";
  }
  if (isSecretKey(rawKey)) {
    return "The key in VITE_SUPABASE_PUBLISHABLE_KEY is a SECRET (service_role) key. Use the publishable / anon key instead — never put the secret key in the app.";
  }
  return null;
}

/** Why the Supabase connection was rejected, or null when it is fine / not set up. */
export const supabaseConfigProblem: string | null = findConfigProblem();

/** True once the project's own Supabase project is connected. */
export const isSupabaseConfigured = Boolean(rawUrl && rawKey && !supabaseConfigProblem);

if (supabaseConfigProblem && isBrowser) {
  console.error(`[Snap & Sell] Supabase is not connected: ${supabaseConfigProblem}`);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl as string, rawKey as string, {
      auth: {
        // Sessions only make sense in the browser; keep the server render stateless.
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser,
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      supabaseConfigProblem ??
        "Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see SETUP.md).",
    );
  }
  return supabase;
}

/**
 * Realtime channel with a unique topic, so two components (or a hot reload)
 * never fight over the same channel name. Do NOT use this for rooms that two
 * different people must share (e.g. a chat thread) — name those explicitly.
 */
export function uniqueChannel(name: string) {
  return requireSupabase().channel(`${name}:${Math.random().toString(36).slice(2, 10)}`);
}
