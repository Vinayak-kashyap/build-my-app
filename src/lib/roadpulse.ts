export const DAMAGE_TYPES = [
  "pothole",
  "crack",
  "waterlogging",
  "landslide",
  "drainage",
  "bridge_damage",
  "streetlight_failure",
  "guardrail_damage",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const SEVERITIES = ["minor", "moderate", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REPAIR_STATUSES = ["pending", "in_progress", "resolved"] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const QUICK_TAGS = [
  "Near School",
  "Near Hospital",
  "Near Intersection",
  "Flooding Risk",
] as const;

export const DAMAGE_LABELS: Record<DamageType, string> = {
  pothole: "Pothole",
  crack: "Surface Crack",
  waterlogging: "Waterlogging",
  landslide: "Landslide Debris",
  drainage: "Drainage Issue",
  bridge_damage: "Bridge Damage",
  streetlight_failure: "Streetlight Failure",
  guardrail_damage: "Guardrail Damage",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  minor: "Minor",
  moderate: "Moderate",
  critical: "Critical",
};

export const STATUS_LABELS: Record<RepairStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
};

/** CSS variable token per severity — keeps map + UI colors in one place. */
export const SEVERITY_TOKEN: Record<Severity, string> = {
  minor: "var(--safe)",
  moderate: "var(--moderate)",
  critical: "var(--critical)",
};

export const WATER_TOKEN = "var(--water)";

export type ReportRow = {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  address: string | null;
  damage_types: DamageType[];
  severity: Severity;
  confidence: number;
  ai_suggestion: string | null;
  ai_summary: string | null;
  notes: string | null;
  tags: string[];
  photos: string[];
  status: RepairStatus;
  upvotes: number;
  downvotes: number;
  report_count: number;
  community_verified: boolean;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
};

/** Waterlogging reports render blue regardless of severity (PRD marker legend). */
export function markerToken(report: Pick<ReportRow, "damage_types" | "severity" | "status">) {
  if (report.status === "resolved") return "var(--safe)";
  if (report.damage_types.includes("waterlogging")) return WATER_TOKEN;
  return SEVERITY_TOKEN[report.severity];
}

export function severityWeight(severity: Severity) {
  return severity === "critical" ? 3 : severity === "moderate" ? 2 : 1;
}

/** Metres between two coordinates. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
