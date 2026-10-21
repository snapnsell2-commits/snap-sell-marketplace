import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/images";
import { updateProfile, uploadAvatar } from "@/lib/marketplace";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Snap & Sell" },
      {
        name: "description",
        content: "Update your photo, username, bio and location so buyers know who they're dealing with.",
      },
      { property: "og:title", content: "Your profile — Snap & Sell" },
      { property: "og:description", content: "Manage your Snap & Sell seller profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setLocation(profile.location ?? "");
    setAvatar(profile.avatar_url);
  }, [profile]);

  if (loading) {
    return <div className="container-page py-24 text-center text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">Sign in to edit your profile</h1>
        <Button className="mt-6 rounded-full" asChild>
          <Link to="/auth" search={{ redirect: "/profile" }}>Sign in</Link>
        </Button>
      </div>
    );
  }

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > MAX_UPLOAD_BYTES) return toast.error("That photo is too large (25 MB max).");
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatar(url);
      toast.success("Photo uploaded. Save to apply.");
    } catch (error) {
      toast.error(errorMessage(error, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,24}$/.test(name)) {
      return toast.error("Usernames are 3–24 characters: letters, numbers, dots, dashes, underscores.");
    }
    setBusy(true);
    try {
      await updateProfile(user.id, {
        username: name,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        avatar_url: avatar,
      });
      await refreshProfile();
      toast.success("Profile saved.");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      toast.error(
        code === "23505" ? "That username is already taken." : errorMessage(error, "Could not save."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page max-w-xl py-10">
      <h1 className="font-display text-3xl font-extrabold">Your profile</h1>

      <form onSubmit={save} className="mt-8 grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage src={avatar ?? undefined} alt="" />
            <AvatarFallback>{(displayName || username || "S").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer rounded-full border px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary">
            {uploading ? "Uploading…" : "Change photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void pickAvatar(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <p className="text-xs text-muted-foreground">Lowercase letters, numbers, dots, dashes and underscores.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="display">Display name</Label>
          <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="loc">Location</Label>
          <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>

        <Button type="submit" disabled={busy} size="lg" className="mt-2 rounded-full">
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
