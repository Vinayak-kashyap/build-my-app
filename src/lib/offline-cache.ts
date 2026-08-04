import { supabase } from "@/integrations/supabase/client";

const PREF_KEY = "roadpulse.autosync";

export type AutoSyncMode = "wifi" | "any" | "off";

export function getAutoSync(): AutoSyncMode {
  if (typeof localStorage === "undefined") return "any";
  const raw = localStorage.getItem(PREF_KEY);
  return raw === "wifi" || raw === "off" || raw === "any" ? raw : "any";
}

export function setAutoSync(mode: AutoSyncMode) {
  localStorage.setItem(PREF_KEY, mode);
}

/** True when auto-sync should run right now given the preference and link type. */
export function autoSyncAllowed(mode: AutoSyncMode): boolean {
  if (mode === "off") return false;
  if (mode === "any") return true;
  const conn = (navigator as Navigator & { connection?: { type?: string; effectiveType?: string } })
    .connection;
  if (!conn?.type) return true; // browser can't tell us — don't block the sync
  return conn.type === "wifi" || conn.type === "ethernet";
}

export type CacheUsage = { usedBytes: number; quotaBytes: number; caches: string[] };

export async function cacheUsage(): Promise<CacheUsage> {
  const estimate = (await navigator.storage?.estimate?.()) ?? {};
  const names = typeof caches !== "undefined" ? await caches.keys() : [];
  return {
    usedBytes: estimate.usage ?? 0,
    quotaBytes: estimate.quota ?? 0,
    caches: names,
  };
}

export async function clearCaches() {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

/** Lightweight connectivity probe used before a manual sync attempt. */
export async function isOnline(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
