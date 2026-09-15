import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
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

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    void navigate({ to: "/dashboard" });
  }

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return toast.error("Connect your database first.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    void navigate({ to: "/dashboard" });
  };

  const signUp = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return toast.error("Connect your database first.");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username || undefined },
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your inbox if confirmation is required.");
  };

  const google = async () => {
    if (!supabase) return toast.error("Connect your database first.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

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
          Accounts turn on once your database is connected.
        </p>
      )}

      <Button variant="outline" className="h-11 rounded-full" onClick={() => void google()}>
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
      </div>

      <Tabs defaultValue="signin">
        <TabsList className="grid w-full grid-cols-2 rounded-full">
          <TabsTrigger value="signin" className="rounded-full">Sign in</TabsTrigger>
          <TabsTrigger value="signup" className="rounded-full">Create account</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={signIn} className="grid gap-3 pt-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">Sign in</Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={signUp} className="grid gap-3 pt-4">
            <div className="grid gap-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="thriftqueen" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email2">Email</Label>
              <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password2">Password</Label>
              <Input id="password2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">Create account</Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
