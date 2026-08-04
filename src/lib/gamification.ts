import { supabase } from "@/integrations/supabase/client";
import type { ReportRow } from "@/lib/roadpulse";

export type LeaderboardScope = "city" | "state" | "national";

export type LeaderboardEntry = {
  user_id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  points: number;
  streak_days: number;
  report_count: number;
  weekly_points: number;
  rank: number;
};

export type BadgeDef = {
  key: string;
  name: string;
  description: string;
  /** emoji glyph keeps the badge grid dependency-free and readable outdoors */
  glyph: string;
  /** progress target, measured against the metric below */
  target: number;
  metric: "reports" | "verified" | "streak";
};

export const BADGES: BadgeDef[] = [
  {
    key: "first_report",
    name: "First Report",
    description: "Submit your very first road damage report.",
    glyph: "🚦",
    target: 1,
    metric: "reports",
  },
  {
    key: "road_guardian",
    name: "Road Guardian",
    description: "Submit 25 reports and keep your city informed.",
    glyph: "🛡️",
    target: 25,
    metric: "reports",
  },
  {
    key: "verified_contributor",
    name: "Verified Contributor",
    description: "Get 5 of your reports community verified.",
    glyph: "✅",
    target: 5,
    metric: "verified",
  },
  {
    key: "hundred_reports",
    name: "100 Reports",
    description: "Reach 100 submitted reports.",
    glyph: "💯",
    target: 100,
    metric: "reports",
  },
  {
    key: "week_warrior",
    name: "Week Warrior",
    description: "Report on 7 consecutive days.",
    glyph: "🔥",
    target: 7,
    metric: "streak",
  },
];

export async function fetchLeaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("leaderboard", { _scope: scope, _limit: 50 });
  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}

export async function fetchMyBadges(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_badges").select("badge_key").eq("user_id", userId);
  return new Set((data ?? []).map((row) => row.badge_key));
}

export async function fetchMyReports(userId: string): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as ReportRow[];
}

export type PointSummary = { total: number; weekly: number };

export async function fetchPointSummary(userId: string): Promise<PointSummary> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: profile }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("points").eq("id", userId).maybeSingle(),
    supabase.from("point_events").select("points").eq("user_id", userId).gte("created_at", since),
  ]);
  return {
    total: profile?.points ?? 0,
    weekly: (events ?? []).reduce((sum, e) => sum + e.points, 0),
  };
}

export function displayName(entry: {
  full_name: string | null;
  username: string | null;
}): string {
  return entry.full_name ?? entry.username ?? "Anonymous";
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
