import { supabase } from "@/integrations/supabase/client";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export type PredictionRow = {
  id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  risk_level: RiskLevel;
  risk_score: number;
  window_days: number;
  predicted_damage: string | null;
  rationale: string | null;
  weather_summary: string | null;
  rainfall_mm: number | null;
  avg_temp_c: number | null;
  report_count: number;
  created_at: string;
};

export type DigestRow = {
  id: string;
  region: string | null;
  period: string;
  headline: string;
  narrative: string;
  created_at: string;
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
  critical: "Critical risk",
};

/** At-risk overlay is amber by design — it is a forecast, not a confirmed hazard. */
export function riskToken(level: RiskLevel) {
  return level === "critical" ? "var(--critical)" : "var(--moderate)";
}

export async function fetchPredictions(): Promise<PredictionRow[]> {
  const { data, error } = await supabase
    .from("road_predictions")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("risk_score", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PredictionRow[];
}

export async function fetchLatestDigest(): Promise<DigestRow | null> {
  const { data } = await supabase
    .from("prediction_digests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DigestRow | null) ?? null;
}
