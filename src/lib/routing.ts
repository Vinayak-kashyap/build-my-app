import {
  distanceMeters,
  severityWeight,
  type ReportRow,
  type Severity,
  type Vehicle,
} from "@/lib/roadpulse";

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
  /** severity as experienced by the selected vehicle */
  severity: Severity;
};

export type ScoredRoute = {
  id: string;
  coordinates: LatLng[];
  distance: number;
  /** raw OSRM driving time, seconds */
  duration: number;
  /** duration plus slow-down caused by the road condition, seconds */
  adjustedDuration: number;
  /** seconds lost to hazards on this route */
  delaySeconds: number;
  steps: RouteStep[];
  hazards: RouteHazard[];
  healthScore: number;
  avoidsDamage: boolean;
  /** hazard counts by vehicle-specific severity */
  counts: Record<Severity, number>;
  vehicle: Vehicle;
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

/** Severity of a report as experienced by the chosen vehicle. */
export function severityFor(report: ReportRow, vehicle: Vehicle): Severity {
  const explicit = vehicle === "bike" ? report.bike_severity : report.car_severity;
  if (explicit) return explicit;
  return deriveVehicleSeverity(vehicle, report.severity, report.damage_types);
}

/** Seconds lost crossing one hazard — two-wheelers slow harder for surface damage. */
const DELAY_SECONDS: Record<Severity, number> = { minor: 10, moderate: 35, critical: 90 };

export function hazardDelay(hazards: RouteHazard[], vehicle: Vehicle) {
  return Math.round(
    hazards.reduce((sum, h) => {
      const base = DELAY_SECONDS[h.severity];
      const verified = h.report.community_verified ? 1.2 : 1;
      const vehicleFactor = vehicle === "bike" ? 1.15 : 1;
      return sum + base * verified * vehicleFactor;
    }, 0),
  );
}

/**
 * Route Health Score: 100 = pristine. Each on-route hazard subtracts by the
 * severity that vehicle actually faces, scaled down on long routes.
 */
export function scoreRoute(hazards: RouteHazard[], distance: number) {
  const km = Math.max(1, distance / 1000);
  const penalty = hazards.reduce((sum, h) => {
    const base = severityWeight(h.severity) * 9;
    const verified = h.report.community_verified ? 1.25 : 1;
    const resolved = h.report.status === "resolved" ? 0.2 : 1;
    return sum + base * verified * resolved;
  }, 0);
  const scaled = penalty / Math.sqrt(km);
  return Math.max(0, Math.min(100, Math.round(100 - scaled)));
}

export function hazardsOnRoute(
  coordinates: LatLng[],
  reports: ReportRow[],
  vehicle: Vehicle,
): RouteHazard[] {
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
      severity: severityFor(report, vehicle),
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

type OsrmRoute = NonNullable<OsrmResponse["routes"]>[number];

function toScored(
  route: OsrmRoute,
  reports: ReportRow[],
  id: string,
  vehicle: Vehicle,
): ScoredRoute {
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
  const hazards = hazardsOnRoute(coordinates, reports, vehicle);
  const steps: RouteStep[] = route.legs
    .flatMap((leg) => leg.steps)
    .map((step) => ({
      instruction: instructionFor(step.maneuver.type, step.maneuver.modifier, step.name),
      distance: step.distance,
      name: step.name,
      location: { lat: step.maneuver.location[1], lng: step.maneuver.location[0] },
    }));
  const counts: Record<Severity, number> = { minor: 0, moderate: 0, critical: 0 };
  for (const h of hazards) counts[h.severity] += 1;
  // Two-wheelers are slower on damaged surfaces but quicker in traffic; cars are
  // the OSRM baseline. Both then pay the per-hazard slow-down.
  const baseDuration = vehicle === "bike" ? route.duration * 0.92 : route.duration;
  const delaySeconds = hazardDelay(hazards, vehicle);
  return {
    id,
    coordinates,
    distance: route.distance,
    duration: Math.round(baseDuration),
    adjustedDuration: Math.round(baseDuration + delaySeconds),
    delaySeconds,
    steps,
    hazards,
    counts,
    vehicle,
    healthScore: scoreRoute(hazards, route.distance),
    avoidsDamage: !hazards.some((h) => h.severity !== "minor"),
  };
}

export async function fetchRoutes(
  from: LatLng,
  to: LatLng,
  reports: ReportRow[],
  options: { emergency?: boolean; vehicle?: Vehicle } = {},
): Promise<ScoredRoute[]> {
  const vehicle: Vehicle = options.vehicle ?? "car";
  const base = (await osrmRoutes([from, to], true)).map((r, i) =>
    toScored(r, reports, `route-${i}`, vehicle),
  );

  // Damage-aware detours: whenever OSRM gives us fewer than three options, or the
  // options all cross Yellow/Red damage, ask for paths around the worst hazard.
  let detours: ScoredRoute[] = [];
  const needsDetour =
    base.length < 3 ||
    (!options.emergency && base.every((r) => r.hazards.some((h) => h.severity !== "minor")));
  if (needsDetour) {
    const worst =
      base[0].hazards
        .filter((h) => h.severity !== "minor")
        .sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))[0] ?? null;
    const midpoint = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
    const pivot = worst
      ? { lat: worst.report.latitude, lng: worst.report.longitude }
      : midpoint;
    const travel = bearing(from, to);
    const candidates = await Promise.allSettled(
      [90, -90].flatMap((side) =>
        [400, 900].map((dist) =>
          osrmRoutes([from, offsetPoint(pivot, travel + side, dist), to], false),
        ),
      ),
    );
    detours = candidates
      .filter(
        (c): c is PromiseFulfilledResult<Awaited<ReturnType<typeof osrmRoutes>>> =>
          c.status === "fulfilled",
      )
      .map((c, i) => toScored(c.value[0], reports, `detour-${i}`, vehicle));
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
    ? unique.sort((a, b) => a.adjustedDuration - b.adjustedDuration)
    : // Damage-aware ordering: best blend of road health and realistic arrival time.
      unique.sort(
        (a, b) =>
          a.adjustedDuration + (100 - a.healthScore) * 6 -
          (b.adjustedDuration + (100 - b.healthScore) * 6),
      );

  return sorted.slice(0, 3).map((r, i) => ({ ...r, id: `route-${i}` }));



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
