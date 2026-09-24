import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  Bike,
  Car,
  ChevronLeft,
  Gauge,
  Loader2,
  Navigation as NavigationIcon,
  Siren,
  TriangleAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { NavMap } from "@/components/map/NavMap";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FILTERS, fetchReports, searchPlaces } from "@/lib/reports";
import {
  DAMAGE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TOKEN,
  VEHICLES,
  VEHICLE_LABELS,
  distanceMeters,
  formatDistance,
  markerToken,
  type ReportRow,
  type Vehicle,
} from "@/lib/roadpulse";
import {
  bearing,
  fetchRoutes,
  formatDuration,
  healthTone,
  type LatLng,
  type ScoredRoute,
} from "@/lib/routing";

import { z } from "zod";

const searchSchema = z.object({
  avoid: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const Route = createFileRoute("/navigation")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Damage-Aware Navigation — RoadPulse" },
      {
        name: "description",
        content:
          "Turn-by-turn routing that avoids damaged and flooded roads, with a Route Health Score for every alternative.",
      },
      { property: "og:title", content: "Damage-Aware Navigation — RoadPulse" },
      {
        property: "og:description",
        content: "Routes scored by road health, hazards avoided, emergency mode for authorities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NavigationScreen,
});

type Place = { label: string; point: LatLng } | null;

function NavigationScreen() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { lat, lng } = Route.useSearch();
  const canUseEmergency = role === "authority" || role === "admin";

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [speedKph, setSpeedKph] = useState(0);
  const [heading, setHeading] = useState(0);

  const [from, setFrom] = useState<Place>(null);
  const [to, setTo] = useState<Place>(null);
  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const [queryText, setQueryText] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);

  const [vehicle, setVehicle] = useState<Vehicle>("car");
  const [routes, setRoutes] = useState<ScoredRoute[]>([]);

  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [hazardPopup, setHazardPopup] = useState<ReportRow | null>(null);
  const [rerouting, setRerouting] = useState(false);
  const [dismissedHazards, setDismissedHazards] = useState<string[]>([]);

  const lastPoint = useRef<LatLng | null>(null);
  const lastReroute = useRef(0);

  useEffect(() => {
    void fetchReports(DEFAULT_FILTERS)
      .then(setReports)
      .catch(() => toast.error("Could not load hazard data"));
  }, []);

  // Live position, speed and heading.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        setSpeedKph(Math.max(0, Math.round((pos.coords.speed ?? 0) * 3.6)));
        if (typeof pos.coords.heading === "number" && !Number.isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        } else if (lastPoint.current) {
          setHeading(bearing(lastPoint.current, next));
        }
        lastPoint.current = next;
        setFrom((current) =>
          current ? current : { label: "Current location", point: next },
        );
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // A "Reroute" tap from the map seeds the destination.
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    setTo({ label: "Hazard area", point: { lat, lng } });
  }, [lat, lng]);

  useEffect(() => {
    if (!activeField || queryText.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchPlaces(queryText).then(setResults);
    }, 400);
    return () => clearTimeout(timer);
  }, [queryText, activeField]);

  const planRoutes = useCallback(
    async (origin: LatLng, destination: LatLng) => {
      setLoadingRoutes(true);
      try {
        // Emergency mode keeps damaged roads in play and ranks by arrival time;
        // standard mode asks for damage-avoiding detours and ranks by road health.
        const found = await fetchRoutes(origin, destination, reports, {
          emergency: emergencyMode,
          vehicle,
        });
        setRoutes(found);
        setActiveRouteId(found[0]?.id ?? null);
        setFitKey((k) => k + 1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not plan a route");
        setRoutes([]);
      } finally {
        setLoadingRoutes(false);
      }
    },
    [reports, emergencyMode, vehicle],
  );


  useEffect(() => {
    if (!from || !to) return;
    void planRoutes(from.point, to.point);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    from?.point.lat,
    from?.point.lng,
    to?.point.lat,
    to?.point.lng,
    emergencyMode,
    vehicle,
    reports.length,
  ]);


  const activeRoute = useMemo(
    () => routes.find((r) => r.id === activeRouteId) ?? null,
    [routes, activeRouteId],
  );

  // Progress along the active route while navigating.
  const progress = useMemo(() => {
    if (!activeRoute || !position) return null;
    let nearestIndex = 0;
    let nearest = Infinity;
    activeRoute.coordinates.forEach((node, index) => {
      const d = distanceMeters(position, node);
      if (d < nearest) {
        nearest = d;
        nearestIndex = index;
      }
    });
    let remaining = 0;
    for (let i = nearestIndex; i < activeRoute.coordinates.length - 1; i += 1) {
      remaining += distanceMeters(activeRoute.coordinates[i], activeRoute.coordinates[i + 1]);
    }
    const step =
      activeRoute.steps
        .map((s) => ({ step: s, d: distanceMeters(position, s.location) }))
        .filter((s) => s.d > 15)
        .sort((a, b) => a.d - b.d)[0] ?? null;
    return {
      offRoute: nearest > 60,
      remainingDistance: remaining,
      remainingSeconds:
        activeRoute.distance > 0
          ? (remaining / activeRoute.distance) * activeRoute.adjustedDuration
          : 0,

      nextStep: step?.step ?? activeRoute.steps[activeRoute.steps.length - 1] ?? null,
      nextStepDistance: step?.d ?? 0,
    };
  }, [activeRoute, position]);

  // Re-route when the driver deviates from the line.
  useEffect(() => {
    if (!navigating || !progress?.offRoute || !position || !to) return;
    if (Date.now() - lastReroute.current < 15000) return;
    lastReroute.current = Date.now();
    setRerouting(true);
    void planRoutes(position, to.point).finally(() => {
      window.setTimeout(() => setRerouting(false), 2500);
    });
  }, [navigating, progress?.offRoute, position, to, planRoutes]);


  const upcomingHazard = useMemo(() => {
    if (!navigating || !activeRoute || !position) return null;
    const candidate = activeRoute.hazards
      .map((h) => ({
        report: h.report,
        distance: distanceMeters(position, {
          lat: h.report.latitude,
          lng: h.report.longitude,
        }),
      }))
      .filter((h) => h.distance <= 400 && !dismissedHazards.includes(h.report.id))
      .sort((a, b) => a.distance - b.distance)[0];
    return candidate ?? null;
  }, [navigating, activeRoute, position, dismissedHazards]);

  function pickResult(result: { display_name: string; lat: string; lon: string }) {
    const place = {
      label: result.display_name,
      point: { lat: Number(result.lat), lng: Number(result.lon) },
    };
    if (activeField === "from") setFrom(place);
    else setTo(place);
    setActiveField(null);
    setQueryText("");
    setResults([]);
  }

  function swap() {
    setFrom(to);
    setTo(from);
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <NavMap
        routes={routes}
        activeRouteId={activeRouteId}
        from={from?.point ?? null}
        to={to?.point ?? null}
        userPosition={position}
        heading={heading}
        autoRotate={navigating}
        fitKey={fitKey}
        onHazardSelect={setHazardPopup}
      />

      {!navigating ? (
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-[800]">
          <div className="glass rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate({ to: "/map" })}
                aria-label="Back to map"
                className="tap-target flex items-center justify-center text-muted-foreground"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <FieldButton
                  label="From"
                  value={from?.label ?? "Current location"}
                  onClick={() => {
                    setActiveField("from");
                    setQueryText("");
                  }}
                />
                <FieldButton
                  label="To"
                  value={to?.label ?? "Choose destination"}
                  onClick={() => {
                    setActiveField("to");
                    setQueryText("");
                  }}
                />
              </div>
              <button
                onClick={swap}
                aria-label="Swap start and destination"
                className="tap-target flex items-center justify-center text-accent"
              >
                <ArrowUpDown className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {activeField ? (
              <div className="mt-3">
                <input
                  autoFocus
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder={`Search ${activeField === "from" ? "start" : "destination"}...`}
                  aria-label={`Search ${activeField}`}
                  className="w-full rounded-xl bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {activeField === "from" && position ? (
                  <button
                    onClick={() => {
                      setFrom({ label: "Current location", point: position });
                      setActiveField(null);
                    }}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-left text-sm text-accent"
                  >
                    Use my current location
                  </button>
                ) : null}
                <ul className="mt-1 max-h-56 overflow-y-auto">
                  {results.map((r) => (
                    <li key={`${r.lat}-${r.lon}`}>
                      <button
                        onClick={() => pickResult(r)}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-elevated"
                      >
                        {r.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Active navigation chrome */}
      {navigating && activeRoute ? (
        <>
          <div className="glass absolute inset-x-3 top-[calc(env(safe-area-inset-top)+10px)] z-[850] rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <NavigationIcon className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold text-foreground">
                  {progress?.nextStep?.instruction ?? "Continue ahead"}
                </p>
                <p className="data-mono text-xs text-muted-foreground">
                  in {formatDistance(progress?.nextStepDistance ?? 0)}
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {rerouting ? (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                role="status"
                className="glass absolute inset-x-3 top-[calc(env(safe-area-inset-top)+96px)] z-[870] flex items-center gap-2 rounded-2xl p-3"
              >
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">
                  Off route — recalculating a damage-aware path
                </span>
              </motion.div>
            ) : emergencyMode ? (
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="glass absolute inset-x-3 top-[calc(env(safe-area-inset-top)+96px)] z-[860] flex items-center gap-2 rounded-2xl p-3"
                style={{ borderColor: "var(--critical)" }}
              >
                <Siren className="h-4 w-4 text-critical" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">
                  Emergency mode — fastest path, {activeRoute.hazards.length} hazard
                  {activeRoute.hazards.length === 1 ? "" : "s"} overlaid
                </span>
              </motion.div>
            ) : null}
          </AnimatePresence>



          <div className="glass absolute bottom-[calc(env(safe-area-inset-bottom)+16px)] inset-x-3 z-[850] rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-accent" aria-hidden="true" />
                <span className="data-mono text-xl font-bold text-foreground">{speedKph}</span>
                <span className="text-xs text-muted-foreground">km/h</span>
              </div>
              <div className="text-right">
                <p className="data-mono text-lg font-bold text-foreground">
                  {formatDuration(progress?.remainingSeconds ?? activeRoute.adjustedDuration)}
                </p>
                <p className="data-mono text-xs text-muted-foreground">
                  {formatDistance(progress?.remainingDistance ?? activeRoute.distance)} left
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setNavigating(false);
                void navigate({ to: "/map" });
              }}
              className="tap-target mt-3 w-full rounded-xl bg-critical text-sm font-bold text-critical-foreground"
            >
              End Navigation
            </button>
          </div>

          <AnimatePresence>
            {upcomingHazard ? (
              <motion.button
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                onClick={() => setHazardPopup(upcomingHazard.report)}
                className="glass absolute inset-x-3 top-[calc(env(safe-area-inset-top)+152px)] z-[860] flex items-center gap-3 rounded-2xl p-3 text-left"
                style={{ borderColor: markerToken(upcomingHazard.report) }}
              >
                <TriangleAlert
                  className="h-6 w-6 shrink-0"
                  style={{ color: markerToken(upcomingHazard.report) }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {DAMAGE_LABELS[upcomingHazard.report.damage_types[0] ?? "pothole"]} ahead
                  </span>
                  <span className="data-mono block text-xs text-muted-foreground">
                    {formatDistance(upcomingHazard.distance)} ·{" "}
                    {SEVERITY_LABELS[upcomingHazard.report.severity]}
                  </span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissedHazards((prev) => [...prev, upcomingHazard.report.id]);
                  }}
                  className="text-xs text-muted-foreground"
                >
                  ✕
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      {/* Route options sheet */}
      {!navigating ? (
        <div className="glass absolute inset-x-0 bottom-0 z-[840] max-h-[52dvh] overflow-y-auto rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
          {canUseEmergency ? (
            <button
              onClick={() => setEmergencyMode((v) => !v)}
              aria-pressed={emergencyMode}
              className="mb-3 flex w-full items-center justify-between rounded-xl bg-surface-elevated px-3 py-3"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Siren
                  className={`h-4 w-4 ${emergencyMode ? "text-critical" : "text-muted-foreground"}`}
                  aria-hidden="true"
                />
                Emergency Vehicle Mode
              </span>
              <span
                className={`h-6 w-11 rounded-full p-0.5 transition-colors ${emergencyMode ? "bg-critical" : "bg-border"}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-foreground transition-transform ${emergencyMode ? "translate-x-5" : ""}`}
                />
              </span>
            </button>
          ) : null}

          {loadingRoutes ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Planning damage-aware
              routes...
            </p>
          ) : !to ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Choose a destination to see route options scored by road health.
            </p>
          ) : routes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No routes available.</p>
          ) : (
            <ul className="space-y-2">
              {routes.map((route, index) => (
                <li key={route.id}>
                  <button
                    onClick={() => {
                      setActiveRouteId(route.id);
                      setFitKey((k) => k + 1);
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      route.id === activeRouteId
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface-elevated"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-bold text-foreground">
                        {formatDuration(route.duration)}
                      </span>
                      <span className="data-mono text-xs text-muted-foreground">
                        {formatDistance(route.distance)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{
                          color: healthTone(route.healthScore),
                          background: "color-mix(in srgb, currentColor 14%, transparent)",
                        }}
                      >
                        Health {route.healthScore}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {route.hazards.length} hazard{route.hazards.length === 1 ? "" : "s"}
                      </span>
                      {route.avoidsDamage ? (
                        <span className="rounded-full bg-safe/15 px-2 py-0.5 text-xs font-semibold text-safe">
                          Avoids Damaged Roads
                        </span>
                      ) : null}
                      {index === 0 && !emergencyMode ? (
                        <span className="text-xs font-semibold text-accent">Recommended</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {activeRoute ? (
            <button
              onClick={() => {
                setNavigating(true);
                setDismissedHazards([]);
              }}
              className="tap-target mt-3 w-full rounded-xl bg-accent text-sm font-bold text-accent-foreground"
            >
              Start Navigation
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Hazard mini popup */}
      <AnimatePresence>
        {hazardPopup ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            role="dialog"
            aria-label="Hazard details"
            className="glass absolute left-1/2 top-1/2 z-[900] w-[86%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-bold text-foreground">
                  {DAMAGE_LABELS[hazardPopup.damage_types[0] ?? "pothole"]}
                </p>
                <p
                  className="text-xs font-semibold"
                  style={{ color: markerToken(hazardPopup) }}
                >
                  {SEVERITY_LABELS[hazardPopup.severity]} · {hazardPopup.confidence}% confidence
                </p>
              </div>
              <button
                onClick={() => setHazardPopup(null)}
                aria-label="Close hazard details"
                className="tap-target flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {hazardPopup.address ? (
              <p className="mt-2 text-sm text-muted-foreground">{hazardPopup.address}</p>
            ) : null}
            {hazardPopup.ai_suggestion ? (
              <p className="mt-2 text-xs text-muted-foreground">{hazardPopup.ai_suggestion}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function FieldButton({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl bg-surface-elevated px-3 py-2 text-left"
    >
      <span className="w-9 shrink-0 text-[11px] font-semibold uppercase text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm text-foreground">{value}</span>
    </button>
  );
}
