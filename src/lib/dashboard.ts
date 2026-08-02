import { supabase } from "@/integrations/supabase/client";
import type { RepairStatus, ReportRow } from "@/lib/roadpulse";

export type QueueRow = ReportRow & {
  priority_score: number;
  ai_confidence: number;
  accident_count: number;
  status_updated_at: string | null;
};

export type DashboardKpis = {
  activeReports: number;
  criticalRoads: number;
  repairedThisMonth: number;
  avgConfidence: number;
  pendingAlerts: number;
};

/** Predicted urgency band derived from the auto-computed priority score. */
export function urgencyBand(score: number) {
  if (score >= 85) return { label: "Immediate", token: "var(--critical)" };
  if (score >= 60) return { label: "High", token: "var(--moderate)" };
  if (score >= 35) return { label: "Medium", token: "var(--water)" };
  return { label: "Low", token: "var(--safe)" };
}

export async function fetchRepairQueue(): Promise<QueueRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("priority_score", { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as unknown as QueueRow[];
}

export async function fetchKpis(userId: string): Promise<DashboardKpis> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [active, critical, repaired, conf, alerts] = await Promise.all([
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .neq("status", "resolved"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("severity", "critical")
      .neq("status", "resolved"),
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("status_updated_at", monthStart.toISOString()),
    supabase.from("reports").select("confidence").neq("status", "resolved").limit(1000),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "authority")
      .eq("reviewed", false),
  ]);

  const values = ((conf.data ?? []) as { confidence: number }[]).map((r) => Number(r.confidence));
  return {
    activeReports: active.count ?? 0,
    criticalRoads: critical.count ?? 0,
    repairedThisMonth: repaired.count ?? 0,
    avgConfidence: values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : 0,
    pendingAlerts: alerts.count ?? 0,
  };
}

export async function updateRepairStatus(reportId: string, status: RepairStatus, userId: string) {
  const { error } = await supabase
    .from("reports")
    .update({ status, status_updated_by: userId })
    .eq("id", reportId);
  if (error) throw error;
}

export async function fetchAuthorityAlerts(userId: string) {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "authority")
    .order("created_at", { ascending: false })
    .limit(25);
  return data ?? [];
}
