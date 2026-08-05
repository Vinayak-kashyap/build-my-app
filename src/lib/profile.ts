import { supabase } from "@/integrations/supabase/client";

export type ProfileUpdate = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  region: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
};

/** Avatars live in a private bucket — resolve a signed URL for display. */
export async function signedAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
  if (error) throw error;
  return path;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("username_available", { _username: username });
  if (error) throw error;
  return Boolean(data);
}

export async function saveProfile(userId: string, patch: Partial<ProfileUpdate>) {
  const { error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export type ProfileStats = { reports: number; points: number; rank: number | null; badges: number };

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const [{ count: reports }, { data: profile }, { count: badges }] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("profiles").select("points").eq("id", userId).maybeSingle(),
    supabase.from("user_badges").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const points = profile?.points ?? 0;
  const { count: ahead } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gt("points", points);

  return {
    reports: reports ?? 0,
    points,
    rank: ahead == null ? null : ahead + 1,
    badges: badges ?? 0,
  };
}

export async function fetchRecentBadges(userId: string, limit = 5) {
  const { data } = await supabase
    .from("user_badges")
    .select("badge_key, earned_at")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as { badge_key: string; earned_at: string }[];
}
