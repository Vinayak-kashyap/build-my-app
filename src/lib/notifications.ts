import { supabase } from "@/integrations/supabase/client";
import type { Severity } from "@/lib/roadpulse";

export const NOTIFICATION_TYPES = [
  "hazard",
  "authority",
  "repair",
  "prediction",
  "community",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  report_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  severity: Severity | null;
  read: boolean;
  reviewed: boolean;
  created_at: string;
};

export type NotificationSettings = {
  user_id: string;
  hazard_proximity: boolean;
  alert_radius_m: number;
  authority_alerts: boolean;
  repair_updates: boolean;
  prediction_warnings: boolean;
  vote_activity: boolean;
  weekly_digest_email: boolean;
};

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  hazard: "Hazard Alert",
  authority: "Authority Alert",
  repair: "Repair Update",
  prediction: "Prediction",
  community: "Community",
};

export const NOTIFICATION_TOKEN: Record<NotificationType, string> = {
  hazard: "var(--critical)",
  authority: "var(--accent)",
  repair: "var(--safe)",
  prediction: "var(--moderate)",
  community: "var(--water)",
};

export const ALERT_RADII = [100, 300, 500, 1000, 2000] as const;

export const DEFAULT_SETTINGS: Omit<NotificationSettings, "user_id"> = {
  hazard_proximity: true,
  alert_radius_m: 500,
  authority_alerts: true,
  repair_updates: true,
  prediction_warnings: true,
  vote_activity: true,
  weekly_digest_email: false,
};

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

export async function markRead(ids: string[]) {
  if (!ids.length) return;
  await supabase.from("notifications").update({ read: true }).in("id", ids);
}

export async function markAllRead(userId: string) {
  await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
}

export async function markReviewed(id: string) {
  await supabase.from("notifications").update({ reviewed: true, read: true }).eq("id", id);
}

export async function fetchSettings(userId: string): Promise<NotificationSettings> {
  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as NotificationSettings;
  const insert = { user_id: userId, ...DEFAULT_SETTINGS };
  await supabase.from("notification_settings").upsert(insert, { onConflict: "user_id" });
  return insert;
}

export async function saveSettings(userId: string, patch: Partial<NotificationSettings>) {
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: userId, ...DEFAULT_SETTINGS, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Insert a personal in-app alert (also used for hazard proximity). */
export async function pushNotification(row: {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  report_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  severity?: Severity | null;
}) {
  await supabase.from("notifications").insert(row);
}

export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.requestPermission();
}

/** Best-effort browser notification; silently no-ops without permission. */
export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icons/icon-192.png", tag: title });
  } catch {
    /* some browsers require a service worker registration — ignore */
  }
}
