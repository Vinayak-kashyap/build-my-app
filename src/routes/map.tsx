import { AnimatePresence, motion } from "framer-motion";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Crosshair,
  Layers,
  LayoutDashboard,

  Mic,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { FilterSheet } from "@/components/map/FilterSheet";
import { PredictionSheet } from "@/components/map/PredictionSheet";
import { ReportDetailSheet } from "@/components/map/ReportDetailSheet";
import { RoadMap, type LayerMode } from "@/components/map/RoadMap";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_SETTINGS, fetchSettings } from "@/lib/notifications";
import { generateForecast } from "@/lib/predict.functions";
import { fetchLatestDigest, fetchPredictions, type DigestRow, type PredictionRow } from "@/lib/predictions";
import { supabase } from "@/integrations/supabase/client";
import { syncPending } from "@/lib/offline-queue";
import { DEFAULT_FILTERS, fetchMyVotes, fetchReports, searchPlaces, type ReportFilters } from "@/lib/reports";
import {
  DAMAGE_LABELS,
  distanceMeters,
  formatDistance,
  markerToken,
  SEVERITY_LABELS,
  type ReportRow,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/map")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { lat?: number; lng?: number } => ({
    ...(typeof search.lat === "number" ? { lat: search.lat } : {}),
    ...(typeof search.lng === "number" ? { lng: search.lng } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Live Road Health Map — RoadPulse" },
      {
        name: "description",
        content:
          "Live map of potholes, cracks and waterlogging with severity heatmaps, community verification and repair status.",
      },
      { property: "og:title", content: "Live Road Health Map — RoadPulse" },
      {
        property: "og:description",
        content: "Real-time road hazard map powered by AI detection and community reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapScreen,
});

const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];
const LAYER_ORDER: LayerMode[] = ["standard", "satellite", "heatmap"];

function MapScreen() {
  const navigate = useNavigate();
  const { lat: focusLat, lng: focusLng } = Route.useSearch();
  const { user, loading, role } = useAuth();
  const [alertRadius, setAlertRadius] = useState<number>(DEFAULT_SETTINGS.alert_radius_m);
  const [hazardAlertsOn, setHazardAlertsOn] = useState(true);

  const [reports, setReports] = useState<ReportRow[]>([]);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [layer, setLayer] = useState<LayerMode>("standard");
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [votes, setVotes] = useState<Map<string, number>>(new Map());
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState<[number, number]>(FALLBACK_CENTER);
  const [recenterKey, setRecenterKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [offline, setOffline] = useState(false);
  const [dismissedHazard, setDismissedHazard] = useState<string | null>(null);
  const firstFix = useRef(true);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [digest, setDigest] = useState<DigestRow | null>(null);
  const [showPredictions, setShowPredictions] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const isAuthority = role === "authority" || role === "admin";

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    try {
      setReports(await fetchReports(filters));
    } catch {
      toast.error("Could not load reports");
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    void fetchMyVotes(user.id).then(setVotes);
    void fetchSettings(user.id)
      .then((s) => {
        setAlertRadius(s.alert_radius_m);
        setHazardAlertsOn(s.hazard_proximity);
      })
      .catch(() => undefined);
  }, [user]);

  // Deep link from dashboard / alerts: centre the map on a coordinate.
  useEffect(() => {
    if (focusLat == null || focusLng == null) return;
    setCenter([focusLat, focusLng]);
    setRecenterKey((k) => k + 1);
    firstFix.current = false;
  }, [focusLat, focusLng]);

  const loadPredictions = useCallback(async () => {
    if (!user) return;
    try {
      setPredictions(await fetchPredictions());
    } catch {
      /* forecast overlay is non-critical */
    }
    if (role === "authority" || role === "admin") {
      setDigest(await fetchLatestDigest());
    }
  }, [user, role]);

  useEffect(() => {
    void loadPredictions();
  }, [loadPredictions]);

  async function runForecast() {
    const origin = position ?? { lat: center[0], lng: center[1] };
    setForecasting(true);
    try {
      const result = await generateForecast({
        data: { lat: origin.lat, lng: origin.lng, span: 0.25, digest: true },
      });
      if (result.predictions === 0) {
        toast.info("Not enough report history in this area yet");
      } else {
        toast.success(`${result.predictions} road segments forecast`);
      }
      await loadPredictions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Forecast failed");
    } finally {
      setForecasting(false);
    }
  }

  // Live map updates.
  useEffect(() => {
    const channel = supabase
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  // Location tracking.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(next);
        if (firstFix.current) {
          firstFix.current = false;
          setCenter([next.lat, next.lng]);
          setRecenterKey((k) => k + 1);
        }
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Offline state + queued report sync.
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    const onOnline = async () => {
      update();
      if (!user) return;
      const synced = await syncPending(user.id);
      if (synced > 0) {
        toast.success(`${synced} offline report${synced > 1 ? "s" : ""} synced`);
        void load();
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", update);
    void onOnline();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", update);
    };
  }, [user, load]);

  const nearbyHazard = useMemo(() => {
    if (!position) return null;
    const candidates = reports
      .filter((r) => r.status !== "resolved" && r.severity !== "minor")
      .map((r) => ({
        report: r,
        distance: distanceMeters(position, { lat: r.latitude, lng: r.longitude }),
      }))
      .filter((c) => c.distance <= alertRadius)
      .sort((a, b) => a.distance - b.distance);
    const closest = candidates[0];
    if (!hazardAlertsOn || !closest || closest.report.id === dismissedHazard) return null;
    return closest;
  }, [position, reports, dismissedHazard, alertRadius, hazardAlertsOn]);

  const atRiskCount = useMemo(
    () =>
      predictions.filter((p) => p.risk_level === "high" || p.risk_level === "critical").length ||
      reports.filter((r) => r.severity === "critical" && r.status === "pending").length,
    [predictions, reports],
  );

  useEffect(() => {
    if (!searchOpen || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchPlaces(query).then(setResults);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, searchOpen]);

  function voiceSearch() {
    const SpeechRecognition =
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition ??
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice search isn't supported on this device");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      setSearchOpen(true);
      setQuery(text);
    };
    recognition.start();
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <RoadMap
        reports={reports}
        layer={layer}
        center={center}
        userPosition={position}
        recenterKey={recenterKey}
        onSelect={setSelected}
        predictions={predictions}
        onSelectPrediction={() => setShowPredictions(true)}
      />

      {/* Search bar */}
      <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+12px)] z-[800]">
        <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search location or address..."
            aria-label="Search location or address"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={voiceSearch}
            aria-label="Voice search"
            className="tap-target flex items-center justify-center text-accent"
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {searchOpen && results.length ? (
          <ul className="glass mt-2 max-h-64 overflow-y-auto rounded-2xl">
            {results.map((r) => (
              <li key={`${r.lat}-${r.lon}`}>
                <button
                  onClick={() => {
                    setCenter([Number(r.lat), Number(r.lon)]);
                    setRecenterKey((k) => k + 1);
                    setSearchOpen(false);
                    setQuery(r.display_name);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-surface-elevated"
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Right control stack */}
      <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+80px)] z-[800] flex flex-col gap-2">
        <ControlButton
          label={`Map layer: ${layer}`}
          onClick={() =>
            setLayer((l) => LAYER_ORDER[(LAYER_ORDER.indexOf(l) + 1) % LAYER_ORDER.length])
          }
        >
          <Layers className="h-5 w-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton
          label="Recenter on my location"
          onClick={() => {
            if (!position) {
              toast.error("Waiting for GPS signal");
              return;
            }
            setCenter([position.lat, position.lng]);
            setRecenterKey((k) => k + 1);
          }}
        >
          <Crosshair className="h-5 w-5" aria-hidden="true" />
        </ControlButton>
        <ControlButton label="Filter reports" onClick={() => setShowFilters(true)}>
          <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
        </ControlButton>
        {isAuthority ? (
          <ControlButton
            label="Open authority dashboard"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
          </ControlButton>
        ) : null}

      </div>

      {/* Status chips */}
      <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+80px)] z-[800] flex flex-col items-start gap-2">
        {atRiskCount > 0 || isAuthority ? (
          <button
            onClick={() => setShowPredictions(true)}
            className="glass rounded-full px-3 py-1.5 text-xs font-semibold text-moderate"
          >
            {atRiskCount} road{atRiskCount === 1 ? "" : "s"} at risk
          </button>
        ) : null}
        {offline ? (
          <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-moderate">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Offline
          </span>
        ) : null}
      </div>

      {/* Hazard proximity banner */}
      <AnimatePresence>
        {nearbyHazard ? (
          <motion.div
            initial={{ y: -120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -120, opacity: 0 }}
            className="glass absolute inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] z-[850] flex items-center gap-3 rounded-2xl p-3"
            style={{ borderColor: markerToken(nearbyHazard.report) }}
            role="alert"
          >
            <TriangleAlert
              className="h-6 w-6 shrink-0"
              style={{ color: markerToken(nearbyHazard.report) }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {DAMAGE_LABELS[nearbyHazard.report.damage_types[0] ?? "pothole"]} ·{" "}
                {SEVERITY_LABELS[nearbyHazard.report.severity]}
              </p>
              <p className="data-mono text-xs text-muted-foreground">
                {formatDistance(nearbyHazard.distance)} ahead
              </p>
            </div>
            <button
              onClick={() =>
                navigate({
                  to: "/navigation",
                  search: {
                    avoid: nearbyHazard.report.id,
                    lat: nearbyHazard.report.latitude,
                    lng: nearbyHazard.report.longitude,
                  },
                })
              }
              className="tap-target rounded-xl bg-accent px-3 text-xs font-bold text-accent-foreground"
            >
              Reroute
            </button>
            <button
              onClick={() => setDismissedHazard(nearbyHazard.report.id)}
              aria-label="Dismiss hazard alert"
              className="text-xs text-muted-foreground"
            >
              ✕
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Camera FAB */}
      <button
        onClick={() => navigate({ to: "/report/capture" })}
        aria-label="Report road damage with camera"
        className="absolute bottom-[calc(env(safe-area-inset-bottom)+78px)] left-1/2 z-[900] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow"
      >
        <Camera className="h-7 w-7" aria-hidden="true" />
      </button>

      <BottomNav />

      <AnimatePresence>
        {showPredictions ? (
          <PredictionSheet
            predictions={predictions}
            digest={digest}
            canForecast={isAuthority}
            generating={forecasting}
            onGenerate={() => void runForecast()}
            onClose={() => setShowPredictions(false)}
            onFocus={(p) => {
              setCenter([p.latitude, p.longitude]);
              setRecenterKey((k) => k + 1);
              setShowPredictions(false);
            }}
          />
        ) : null}
        {showFilters ? (
          <FilterSheet
            filters={filters}
            onClose={() => setShowFilters(false)}
            onApply={(next) => {
              setFilters(next);
              setShowFilters(false);
            }}
          />
        ) : null}
        {selected ? (
          <ReportDetailSheet
            report={selected}
            myVote={votes.get(selected.id)}
            onClose={() => setSelected(null)}
            onVoted={(reportId, value) => {
              setVotes((prev) => {
                const next = new Map(prev);
                if (value === 0) next.delete(reportId);
                else next.set(reportId, value);
                return next;
              });
              void load();
            }}
          />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="glass tap-target flex items-center justify-center rounded-xl text-foreground"
    >
      {children}
    </button>
  );
}
