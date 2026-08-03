import { distanceMeters, severityWeight, type ReportRow } from "@/lib/roadpulse";

export type LatLng = { lat: number; lng: number };

export type RouteStep = {
  instruction: string;
  distance: number;
  name: string;
  location: LatLng;
};

export type RouteHazard = {
  report: ReportRow;
  /** metres along the route where the hazard sits */
  along: number;
};

export type ScoredRoute = {
  id: string;
  coordinates: LatLng[];
  distance: number;
  duration: number;
  steps: RouteStep[];
  hazards: RouteHazard[];
  healthScore: number;
  avoidsDamage: boolean;
};

const OSRM = "https://router.project-osrm.org/route/v1/driving";

/** Reports this close to the line are treated as on-route. */
const HAZARD_CORRIDOR_M = 45;

type OsrmResponse = {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: {
      steps: {
        distance: number;
        name: string;
        maneuver: { type: string; modifier?: string; location: [number, number] };
      }[];
    }[];
  }[];
};

function instructionFor(type: string, modifier: string | undefined, name: string) {
  const road = name ? ` onto ${name}` : "";
  switch (type) {
    case "depart":
      return `Head out${name ? ` on ${name}` : ""}`;
    case "arrive":
      return "Arrive at your destination";
    case "roundabout":
    case "rotary":
      return `Take the roundabout${road}`;
    case "merge":
      return `Merge${road}`;
    case "fork":
      return `Keep ${modifier ?? "straight"}${road}`;
    case "new name":
      return `Continue${road}`;
    case "end of road":
      return `Turn ${modifier ?? "straight"}${road}`;
    default:
      return modifier && modifier !== "straight"
        ? `Turn ${modifier}${road}`
        : `Continue${road}`;
  }
}

/** Perpendicular-ish distance from a point to a polyline, in metres. */
export function distanceToPath(point: LatLng, path: LatLng[]) {
  let best = Infinity;
  for (const node of path) {
    const d = distanceMeters(point, node);
    if (d < best) best = d;
  }
  return best;
}

function metresAlong(point: LatLng, path: LatLng[]) {
  let travelled = 0;
  let bestAt = 0;
  let best = Infinity;
  for (let i = 0; i < path.length; i += 1) {
    if (i > 0) travelled += distanceMeters(path[i - 1], path[i]);
    const d = distanceMeters(point, path[i]);
    if (d < best) {
      best = d;
      bestAt = travelled;
    }
  }
  return bestAt;
}

/**
 * Route Health Score: 100 = pristine. Each on-route hazard subtracts by severity,
 * scaled down on long routes so a single pothole doesn't tank a 40 km trip.
 */
export function scoreRoute(hazards: RouteHazard[], distance: number) {
  const km = Math.max(1, distance / 1000);
  const penalty = hazards.reduce((sum, h) => {
    const base = severityWeight(h.report.severity) * 9;
    const verified = h.report.community_verified ? 1.25 : 1;
    const resolved = h.report.status === "resolved" ? 0.2 : 1;
    return sum + base * verified * resolved;
  }, 0);
  const scaled = penalty / Math.sqrt(km);
  return Math.max(0, Math.min(100, Math.round(100 - scaled)));
}

export function hazardsOnRoute(coordinates: LatLng[], reports: ReportRow[]): RouteHazard[] {
  const sampled = coordinates.filter((_, i) => i % 2 === 0 || i === coordinates.length - 1);
  return reports
    .filter((r) => r.status !== "resolved")
    .map((report) => ({
      report,
      distance: distanceToPath({ lat: report.latitude, lng: report.longitude }, sampled),
    }))
    .filter((h) => h.distance <= HAZARD_CORRIDOR_M)
    .map(({ report }) => ({
      report,
      along: metresAlong({ lat: report.latitude, lng: report.longitude }, coordinates),
    }))
    .sort((a, b) => a.along - b.along);
}

async function osrmRoutes(points: LatLng[], alternatives: boolean) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM}/${coords}?alternatives=${alternatives ? 3 : "false"}&overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Routing service unavailable");
  const json = (await res.json()) as OsrmResponse;
  if (json.code !== "Ok" || !json.routes?.length) throw new Error("No route found");
  return json.routes;
}

/** Offset a point perpendicular to the travel direction, in metres. */
function offsetPoint(point: LatLng, headingDeg: number, metres: number): LatLng {
  const rad = (headingDeg * Math.PI) / 180;
  const dLat = (metres * Math.cos(rad)) / 111_320;
  const dLng = (metres * Math.sin(rad)) / (111_320 * Math.cos((point.lat * Math.PI) / 180));
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

function toScored(
  route: OsrmResponse["routes"] extends (infer R)[] ? R : never,
  reports: ReportRow[],
  id: string,
): ScoredRoute {
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const hazards = hazardsOnRoute(coordinates, reports);
  const steps: RouteStep[] = route.legs
    .flatMap((leg) => leg.steps)
    .map((step) => ({
      instruction: instructionFor(step.maneuver.type, step.maneuver.modifier, step.name),
      distance: step.distance,
      name: step.name,
      location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
    }));
  return {
    id,
    coordinates,
    distance: route.distance,
    duration: route.duration,
    steps,
    hazards,
    healthScore: scoreRoute(hazards, route.distance),
    avoidsDamage: !hazards.some((h) => h.report.severity !== "minor"),
  };
}

export async function fetchRoutes(
  from: LatLng,
  to: LatLng,
  reports: ReportRow[],
  options: { emergency?: boolean } = {},
): Promise<ScoredRoute[]> {
  const base = (await osrmRoutes([from, to], true)).map((r, i) => toScored(r, reports, `route-${i}`));

  // Damage-aware detours: when every OSRM alternative still crosses Yellow/Red
  // damage, re-ask for routes through waypoints offset away from the worst hazard.
  let detours: ScoredRoute[] = [];
  const needsDetour =
    !options.emergency && base.every((r) => r.hazards.some((h) => h.report.severity !== "minor"));
  if (needsDetour) {
    const worst = base[0].hazards
      .filter((h) => h.report.severity !== "minor")
      .sort((a, b) => severityWeight(b.report.severity) - severityWeight(a.report.severity))[0];
    if (worst) {
      const hazardPoint = { lat: worst.report.latitude, lng: worst.report.longitude };
      const travel = bearing(from, to);
      const candidates = await Promise.allSettled(
        [90, -90].flatMap((side) =>
          [350, 700].map((dist) =>
            osrmRoutes([from, offsetPoint(hazardPoint, travel + side, dist), to], false),
          ),
        ),
      );
      detours = candidates
        .filter(
          (c): c is PromiseFulfilledResult<Awaited<ReturnType<typeof osrmRoutes>>> =>
            c.status === "fulfilled",
        )
        .map((c, i) => toScored(c.value[0], reports, `detour-${i}`));
    }
  }

  // De-duplicate near-identical geometries by distance signature.
  const seen = new Set<number>();
  const unique = [...base, ...detours].filter((r) => {
    const key = Math.round(r.distance / 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sorted = options.emergency
    ? unique.sort((a, b) => a.duration - b.duration)
    : // Damage-aware ordering: healthiest route first, ties broken by time.
      unique.sort((a, b) => b.healthScore - a.healthScore || a.duration - b.duration);

  return sorted.slice(0, 3).map((r, i) => ({ ...r, id: `route-${i}` }));
}


export function formatDuration(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours} h ${mins % 60} min`;
}

export function healthTone(score: number) {
  if (score >= 80) return "var(--safe)";
  if (score >= 55) return "var(--moderate)";
  return "var(--critical)";
}

export function bearing(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
