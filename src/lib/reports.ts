import { supabase } from "@/integrations/supabase/client";
import type { DamageType, ReportRow, Severity } from "@/lib/roadpulse";

export type ReportFilters = {
  damageTypes: DamageType[];
  severities: Severity[];
  /** hours; null = all time */
  withinHours: number | null;
};

export const DEFAULT_FILTERS: ReportFilters = {
  damageTypes: [],
  severities: [],
  withinHours: null,
};

export async function fetchReports(filters: ReportFilters): Promise<ReportRow[]> {
  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.damageTypes.length) query = query.overlaps("damage_types", filters.damageTypes);
  if (filters.severities.length) query = query.in("severity", filters.severities);
  if (filters.withinHours) {
    const since = new Date(Date.now() - filters.withinHours * 3600_000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

const urlCache = new Map<string, string>();

/** Report photos live in a private bucket — resolve short-lived signed URLs. */
export async function signedPhotoUrls(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const missing = paths.filter((p) => !urlCache.has(p));
  if (missing.length) {
    const { data } = await supabase.storage
      .from("report-photos")
      .createSignedUrls(missing, 3600);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) urlCache.set(item.path, item.signedUrl);
    }
  }
  return paths.map((p) => urlCache.get(p)).filter((u): u is string => Boolean(u));
}

export async function castVote(reportId: string, userId: string, value: 1 | -1 | 0) {
  if (value === 0) {
    const { error } = await supabase
      .from("report_votes")
      .delete()
      .eq("report_id", reportId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("report_votes")
    .upsert({ report_id: reportId, user_id: userId, value }, { onConflict: "report_id,user_id" });
  if (error) throw error;
}

export async function fetchMyVotes(userId: string) {
  const { data } = await supabase
    .from("report_votes")
    .select("report_id, value")
    .eq("user_id", userId);
  const map = new Map<string, number>();
  for (const row of data ?? []) map.set(row.report_id, row.value);
  return map;
}

/** Free reverse geocoding via OpenStreetMap Nominatim. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string };
    return json.display_name ?? null;
  } catch {
    return null;
  }
}

export async function searchPlaces(query: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return [];
    return (await res.json()) as { display_name: string; lat: string; lon: string }[];
  } catch {
    return [];
  }
}
