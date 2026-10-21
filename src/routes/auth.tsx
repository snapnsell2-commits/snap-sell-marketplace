import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, supabase, supabaseConfigProblem } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string | undefined } => {
    const target = search["redirect"];
    // Only allow in-app paths, never another site.
    return typeof target === "string" && target.startsWith("/") && !target.startsWith("//")
      ? { redirect: target }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in or join — Snap & Sell" },
      {
        name: "description",
        content:
          "Create your Snap & Sell account to list items, send offers, save favourites and chat with sellers.",
      },
      { property: "og:title", content: "Sign in or join — Snap & Sell" },
      {
        property: "og:description",
        content: "Sign in with email or Google to buy, sell and message on Snap & Sell.",
      },
    ],
  }),
  component: AuthPage,
});

/** Turns raw Supabase errors into something a human can act on. */
function friendlyError(message: string, status?: number): string {
  const m = message.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts or emails sent. Please wait a few minutes and try again.";
  }
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match. Signed up with Google? Use the Google button instead.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox (and spam folder) for the link.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Try signing in or resetting your password.";
  }
  if (m.includes("database error saving new user")) {
    return "We couldn't finish creating your account. Run the latest supabase/schema.sql in your Supabase SQL editor, then try again.";
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) {
    return "Sign-ups are switched off in your Supabase project (Authentication → Sign In / Providers).";
  }
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "Google sign-in isn't switched on in your Supabase project yet. See SETUP.md.";
  }
  if (m.includes("password should be at least")) {
    return "Choose a longer password (at least 8 characters).";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "Can't reach the server. Check your internet connection and that VITE_SUPABASE_URL is correct.";
  }
  return message;
}

const cleanUsername = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "")
    .slice(0, 24);

function AuthPage() {
  const router = useRouter();
  const { redirect } = Route.useSearch();
  const { user, loading } = useAuth();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [mode, setMode] = useState<"form" | "forgot">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Already signed in (or just finished signing in / confirming email): leave this page.
  useEffect(() => {
    if (!loading && user) void router.history.push(redirect ?? "/dashboard");
  }, [user, loading, redirect, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const notConnected = () => {
    toast.error(
      supabaseConfigProblem ?? "The database isn't connected yet. See SETUP.md to connect Supabase.",
    );
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return notConnected();
    setBusy(true);
    setNeedsConfirmation(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) setNeedsConfirmation(true);
      return toast.error(friendlyError(error.message, error.status));
    }
    toast.success("Welcome back!");
    // The effect above redirects as soon as the session is in place.
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return notConnected();
    const chosen = cleanUsername(username);
    if (username.trim() && chosen.length < 3) {
      return toast.error("Usernames need at least 3 letters or numbers (a–z, 0–9, . _ -).");
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: chosen ? { username: chosen } : {},
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message, error.status));

    // When confirmation is on, Supabase answers "success" for an email that is
    // already registered but returns a user with no identities. Catch that.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setTab("signin");
      return toast.error(
        "An account with this email already exists. Sign in instead, or reset your password.",
      );
    }
    if (data.session) {
      toast.success("Account created — welcome to Snap & Sell!");
      return; // redirected by the effect above
    }
    setAwaitingConfirmation(email.trim());
    setCooldown(30);
  };

  const resend = async (address: string) => {
    if (!supabase) return notConnected();
    if (cooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) return toast.error(friendlyError(error.message, error.status));
    setCooldown(60);
    toast.success("Confirmation email sent again. Check your inbox and spam folder.");
  };

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return notConnected();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message, error.status));
    toast.success("If that email has an account, a reset link is on its way.");
    setMode("form");
  };

  const google = async () => {
    if (!supabase) return notConnected();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(friendlyError(error.message, error.status));
  };

  if (awaitingConfirmation) {
    return (
      <div className="container-page grid max-w-md gap-5 py-14 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <MailCheck className="size-7" />
        </span>
        <h1 className="font-display text-3xl font-extrabold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{awaitingConfirmation}</span>. Open it to
          finish creating your account. It can take a minute, and it may land in spam.
        </p>
        <Button
          variant="outline"
          className="h-11 rounded-full"
          disabled={cooldown > 0}
          onClick={() => void resend(awaitingConfirmation)}
        >
          {cooldown > 0 ? `Resend email (${cooldown}s)` : "Resend email"}
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={() => setAwaitingConfirmation(null)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page grid max-w-md gap-6 py-14">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">Welcome to Snap &amp; Sell</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to list items, make offers and chat with sellers.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          {supabaseConfigProblem ?? "Accounts turn on once your database is connected (see SETUP.md)."}
        </p>
      )}

      {mode === "forgot" ? (
        <form onSubmit={sendReset} className="grid gap-3">
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">Reset your password</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to choose a new one.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">
            {busy ? "Sending…" : "Send reset link"}
          </Button>
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => setMode("form")}>
            Back to sign in
          </Button>
        </form>
      ) : (
        <>
          <Button variant="outline" className="h-11 rounded-full" onClick={() => void google()}>
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v === "signup" ? "signup" : "signin")}>
            <TabsList className="grid w-full grid-cols-2 rounded-full">
              <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="grid gap-3 pt-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                {needsConfirmation && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    disabled={cooldown > 0 || !email.trim()}
                    onClick={() => void resend(email.trim())}
                  >
                    {cooldown > 0 ? `Resend confirmation (${cooldown}s)` : "Resend confirmation email"}
                  </Button>
                )}
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="grid gap-3 pt-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="username">Username (optional)</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="thriftqueen"
                  />
                  <p className="text-xs text-muted-foreground">
                    Letters, numbers, dots, dashes and underscores. We&apos;ll pick one for you if you skip it.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input
                    id="email2"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <Input
                    id="password2"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
