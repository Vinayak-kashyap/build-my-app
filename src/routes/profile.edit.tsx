import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/gamification";
import { isUsernameAvailable, saveProfile, signedAvatarUrl, uploadAvatar } from "@/lib/profile";

export const Route = createFileRoute("/profile/edit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Edit Profile — RoadPulse" },
      {
        name: "description",
        content: "Update your RoadPulse avatar, name, username, bio and home region.",
      },
      { property: "og:title", content: "Edit Profile — RoadPulse" },
      { property: "og:description", content: "Keep your RoadPulse contributor profile current." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileEditScreen,
});

function ProfileEditScreen() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setRegion(profile.region ?? "");
    setAvatarPath(profile.avatar_url ?? null);
    void signedAvatarUrl(profile.avatar_url ?? null).then(setPreview);
  }, [profile]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const value = username.trim();
    if (!value || value === (profile?.username ?? "")) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        setAvailable(await isUsernameAvailable(value));
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, profile?.username]);

  async function onPickAvatar(file: File) {
    if (!user) return;
    try {
      const path = await uploadAvatar(user.id, file);
      setAvatarPath(path);
      setPreview(await signedAvatarUrl(path));
      toast.success("Avatar uploaded");
    } catch {
      toast.error("Could not upload that image");
    }
  }

  async function onSave() {
    if (!user) return;
    if (available === false) {
      toast.error("That username is taken");
      return;
    }
    setSaving(true);
    try {
      await saveProfile(user.id, {
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        bio: bio.trim() || null,
        region: region.trim() || null,
        city: city.trim() || null,
        avatar_url: avatarPath,
      });
      await refreshProfile();
      toast.success("Profile updated");
      void navigate({ to: "/profile" });
    } catch {
      toast.error("Could not save your profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background px-6 pb-16 pt-12">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/profile" })}
          aria-label="Back to profile"
          className="tap-target rounded-xl border border-border p-2 text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Edit Profile</h1>
      </header>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative h-24 w-24 overflow-hidden rounded-full border border-border bg-surface"
          aria-label="Change avatar"
        >
          {preview ? (
            <img src={preview} alt="Your avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-accent">
              {fullName ? initials(fullName) : "?"}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-background/70 py-1 text-[10px] font-semibold text-accent">
            <Camera className="mr-1 h-3 w-3" aria-hidden="true" /> Change
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickAvatar(file);
          }}
        />
      </div>

      <div className="mt-6 space-y-4">
        <Field label="Full Name">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Your name"
          />
        </Field>

        <Field label="Username">
          <div className="relative">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-10 text-sm text-foreground outline-none focus:border-accent"
              placeholder="roadwatcher"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : available === true ? (
                <Check className="h-4 w-4 text-safe" />
              ) : available === false ? (
                <X className="h-4 w-4 text-critical" />
              ) : null}
            </span>
          </div>
          {available === false ? (
            <p className="mt-1 text-xs text-critical">That username is already taken.</p>
          ) : available === true ? (
            <p className="mt-1 text-xs text-safe">Username is available.</p>
          ) : null}
        </Field>

        <Field label="Bio (optional)">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent"
            placeholder="Tell the community what you watch out for"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Region / State">
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent"
              placeholder="Maharashtra"
            />
          </Field>
          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none focus:border-accent"
              placeholder="Mumbai"
            />
          </Field>
        </div>
      </div>

      <button
        disabled={saving}
        onClick={() => void onSave()}
        className="tap-target mt-7 w-full rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-accent-foreground disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
      <button
        onClick={() => navigate({ to: "/profile" })}
        className="tap-target mt-3 w-full text-center text-sm font-semibold text-muted-foreground"
      >
        Cancel
      </button>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
