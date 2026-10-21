import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Snap & Sell" },
      { name: "description", content: "Set a new password for your Snap & Sell account." },
      { property: "og:title", content: "Choose a new password — Snap & Sell" },
      { property: "og:description", content: "Set a new password for your Snap & Sell account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Supabase puts problems with the emailed link (expired, already used) in the URL.
  useEffect(() => {
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const fromQuery = new URLSearchParams(window.location.search);
    const description = fromHash.get("error_description") ?? fromQuery.get("error_description");
    if (description) setLinkError(description);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return toast.error("Choose a password with at least 8 characters.");
    if (password !== confirm) return toast.error("The two passwords don't match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    void router.history.push("/dashboard");
  };

  if (loading) {
    return <div className="container-page max-w-md py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-page max-w-md py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">This reset link can&apos;t be used</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {linkError ?? "It may have expired or already been used."} Request a fresh one and try again.
        </p>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/auth">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page grid max-w-md gap-6 py-14">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {user.email}.</p>
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy} className="mt-2 h-11 rounded-full">
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
