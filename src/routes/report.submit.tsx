import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, MapPin, Pencil, Plus, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { queueReport, uploadReport } from "@/lib/offline-queue";
import {
  clearDraft,
  compressImage,
  emptyDraft,
  loadDraft,
  saveDraft,
  type ReportDraft,
} from "@/lib/report-draft";
import { reverseGeocode } from "@/lib/reports";
import {
  DAMAGE_LABELS,
  DAMAGE_TYPES,
  formatCoords,
  QUICK_TAGS,
  SEVERITIES,
  SEVERITY_LABELS,
  SEVERITY_TOKEN,
  type DamageType,
  type Severity,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/report/submit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Confirm Report — RoadPulse" },
      {
        name: "description",
        content: "Review AI findings, adjust the location and submit your road damage report.",
      },
      { property: "og:title", content: "Confirm Report — RoadPulse" },
      { property: "og:description", content: "Submit verified road damage reports in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmitScreen,
});

const MAX_PHOTOS = 5;

function SubmitScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);

  const [draft, setDraft] = useState<ReportDraft>(() => loadDraft() ?? emptyDraft);
  const [editingAi, setEditingAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  // Initial GPS fix + reverse geocode.
  useEffect(() => {
    if (draft.latitude != null || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const address = await reverseGeocode(lat, lng);
        setDraft((d) => ({ ...d, latitude: lat, longitude: lng, address }));
      },
      () => toast.error("Couldn't get GPS — drag the pin to set the location"),
      { enableHighAccuracy: true },
    );
  }, [draft.latitude]);

  // Mini-map with a draggable pin.
  useEffect(() => {
    if (!mapRef.current || draft.latitude == null || draft.longitude == null) return;
    let map: any;
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current) return;
      map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView(
        [draft.latitude!, draft.longitude!],
        17,
      );
      L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
      }).addTo(map);
      const marker = L.marker([draft.latitude!, draft.longitude!], { draggable: true }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", async () => {
        const { lat, lng } = marker.getLatLng();
        const address = await reverseGeocode(lat, lng);
        setDraft((d) => ({ ...d, latitude: lat, longitude: lng, address }));
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // Only re-init when the pin first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.latitude == null]);

  async function addPhotos(files: FileList) {
    const room = MAX_PHOTOS - draft.photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const encoded = await Promise.all(picked.map((f) => compressImage(f)));
    setDraft((d) => ({ ...d, photos: [...d.photos, ...encoded].slice(0, MAX_PHOTOS) }));
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function submit() {
    if (!user) {
      toast.error("Sign in to submit a report");
      return;
    }
    if (!draft.photos.length) {
      toast.error("Add at least one photo");
      return;
    }
    if (draft.latitude == null || draft.longitude == null) {
      toast.error("Set the report location first");
      return;
    }
    if (!draft.damage_types.length) {
      toast.error("Select at least one damage type");
      return;
    }

    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await queueReport(draft);
        toast.success("Saved offline — it'll sync automatically");
      } else {
        await uploadReport(draft, user.id);
        toast.success("Report submitted. Thank you!");
      }
      clearDraft();
      void navigate({ to: "/map" });
    } catch (error) {
      try {
        await queueReport(draft);
        toast.message("Upload failed — report queued for later sync");
        clearDraft();
        void navigate({ to: "/map" });
      } catch {
        toast.error(error instanceof Error ? error.message : "Could not submit report");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-32">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <button
          onClick={() => navigate({ to: "/map" })}
          aria-label="Cancel report"
          className="tap-target flex items-center justify-center text-muted-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Confirm Report</h1>
        {offline ? (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-moderate">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            Offline
          </span>
        ) : null}
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* Photos */}
        <section className="glass rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Photos</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draft.photos.map((photo, index) => (
              <div key={index} className="relative shrink-0">
                <img
                  src={photo}
                  alt={`Road damage photo ${index + 1}`}
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <button
                  onClick={() =>
                    setDraft((d) => ({ ...d, photos: d.photos.filter((_, i) => i !== index) }))
                  }
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-critical text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {draft.photos.length < MAX_PHOTOS ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add More
              </button>
            ) : null}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && void addPhotos(e.target.files)}
          />
        </section>

        {/* AI summary */}
        <section className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">AI Assessment</h2>
            <button
              onClick={() => setEditingAi((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-accent"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              {editingAi ? "Done" : "Edit"}
            </button>
          </div>

          {!editingAi ? (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.damage_types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-foreground"
                  >
                    {DAMAGE_LABELS[type]}
                  </span>
                ))}
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{
                    color: SEVERITY_TOKEN[draft.severity],
                    backgroundColor: `color-mix(in oklab, ${SEVERITY_TOKEN[draft.severity]} 18%, transparent)`,
                  }}
                >
                  {SEVERITY_LABELS[draft.severity]}
                </span>
                {draft.confidence ? (
                  <span className="data-mono text-xs text-accent">{draft.confidence}%</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                {VEHICLES.map((vehicle) => {
                  const level =
                    vehicle === "bike"
                      ? (draft.bike_severity ?? draft.severity)
                      : (draft.car_severity ?? draft.severity);
                  return (
                    <span
                      key={vehicle}
                      className="flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                      style={{
                        color: SEVERITY_TOKEN[level],
                        backgroundColor: `color-mix(in oklab, ${SEVERITY_TOKEN[level]} 14%, transparent)`,
                      }}
                    >
                      {VEHICLE_LABELS[vehicle]}: {SEVERITY_LABELS[level]}
                    </span>
                  );
                })}
              </div>
              {draft.ai_suggestion ? (
                <p className="text-xs text-muted-foreground">{draft.ai_suggestion}</p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {DAMAGE_TYPES.map((type) => {
                  const active = draft.damage_types.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          damage_types: toggle(d.damage_types, type as DamageType),
                        }))
                      }
                      aria-pressed={active}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        active
                          ? "bg-accent text-accent-foreground"
                          : "bg-surface-elevated text-muted-foreground"
                      }`}
                    >
                      {DAMAGE_LABELS[type]}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {SEVERITIES.map((severity) => {
                  const active = draft.severity === severity;
                  return (
                    <button
                      key={severity}
                      onClick={() => setDraft((d) => ({ ...d, severity: severity as Severity }))}
                      aria-pressed={active}
                      className="flex-1 rounded-xl px-3 py-2 text-xs font-bold"
                      style={{
                        color: active ? "var(--background)" : SEVERITY_TOKEN[severity],
                        backgroundColor: active
                          ? SEVERITY_TOKEN[severity]
                          : `color-mix(in oklab, ${SEVERITY_TOKEN[severity]} 14%, transparent)`,
                      }}
                    >
                      {SEVERITY_LABELS[severity]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Location */}
        <section className="glass rounded-2xl p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
            Location
          </h2>
          {draft.latitude != null ? (
            <>
              <div
                ref={mapRef}
                className="h-40 w-full overflow-hidden rounded-xl"
                role="application"
                aria-label="Draggable location pin map"
              />
              <p className="data-mono mt-2 text-xs text-accent">
                {formatCoords(draft.latitude, draft.longitude ?? 0)}
              </p>
              <input
                value={draft.address ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
                aria-label="Address"
                placeholder="Address"
                className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Drag the pin to adjust the exact spot.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Locating…</p>
          )}
        </section>

        {/* Notes + tags */}
        <section className="glass rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Notes & Tags</h2>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            rows={3}
            aria-label="Additional notes"
            placeholder="Anything else authorities should know? (optional)"
            className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => {
              const active = draft.tags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => setDraft((d) => ({ ...d, tags: toggle(d.tags, tag) }))}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-surface-elevated text-muted-foreground"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] backdrop-blur">
        <button
          onClick={submit}
          disabled={submitting}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-accent-foreground disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {offline ? "Save Offline" : "Submit Report"}
        </button>
        <button
          onClick={() => {
            clearDraft();
            void navigate({ to: "/map" });
          }}
          className="mt-2 w-full text-center text-xs text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
