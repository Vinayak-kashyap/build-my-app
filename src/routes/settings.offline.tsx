import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CloudOff, Database, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { listPending, syncPending, type PendingReport } from "@/lib/offline-queue";
import {
  autoSyncAllowed,
  cacheUsage,
  clearCaches,
  formatBytes,
  getAutoSync,
  isOnline,
  setAutoSync,
  type AutoSyncMode,
  type CacheUsage,
} from "@/lib/offline-cache";
import { DAMAGE_LABELS } from "@/lib/roadpulse";

export const Route = createFileRoute("/settings/offline")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Offline & Sync — RoadPulse" },
      {
        name: "description",
        content:
          "Review reports waiting to sync, manage cached map areas and choose when RoadPulse syncs.",
      },
      { property: "og:title", content: "Offline & Sync — RoadPulse" },
      {
        property: "og:description",
        content: "Manage RoadPulse offline storage and pending report sync.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OfflineSettingsScreen,
});

const MODES: { value: AutoSyncMode; label: string; hint: string }[] = [
  { value: "any", label: "Any connection", hint: "Sync as soon as you're back online" },
  { value: "wifi", label: "Wi-Fi only", hint: "Wait for an unmetered network" },
  { value: "off", label: "Manual only", hint: "Only sync when you tap Sync Now" },
];

function OfflineSettingsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingReport[]>([]);
  const [usage, setUsage] = useState<CacheUsage | null>(null);
  const [mode, setMode] = useState<AutoSyncMode>("any");
  const [syncing, setSyncing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(async () => {
    setPending(await listPending());
    setUsage(await cacheUsage().catch(() => null));
  }, []);

  useEffect(() => {
    setMode(getAutoSync());
    void refresh();
  }, [refresh]);

  const runSync = useCallback(
    async (manual: boolean) => {
      if (!user) return;
      if (!manual && !autoSyncAllowed(getAutoSync())) return;
      if (!(await isOnline())) {
        if (manual) toast.error("Still offline — reports stay queued");
        return;
      }
      setSyncing(true);
      try {
        const synced = await syncPending(user.id);
        if (synced > 0) toast.success(`${synced} report${synced === 1 ? "" : "s"} synced`);
        else if (manual) toast.info("Nothing left to sync");
      } catch {
        toast.error("Sync failed — we'll retry later");
      } finally {
        setSyncing(false);
        void refresh();
      }
    },
    [user, refresh],
  );

  useEffect(() => {
    const onReconnect = () => void runSync(false);
    window.addEventListener("online", onReconnect);
    return () => window.removeEventListener("online", onReconnect);
  }, [runSync]);

  return (
    <main className="min-h-[100dvh] bg-background px-5 pb-16 pt-[calc(env(safe-area-inset-top)+16px)]">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/profile" })}
          aria-label="Back to profile"
          className="tap-target flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Offline &amp; Sync</h1>
      </header>

      <section className="glass mb-4 rounded-2xl p-4">
        <div className="flex items-center gap-2">
          <CloudOff className="h-4 w-4 text-warning" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">
            {pending.length} report{pending.length === 1 ? "" : "s"} pending sync
          </h2>
        </div>
        {pending.length ? (
          <ul className="mt-3 space-y-2">
            {pending.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-xs"
              >
                <p className="font-semibold text-foreground">
                  {entry.damage_types.map((d) => DAMAGE_LABELS[d]).join(", ") || "Road damage"}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {entry.latitude?.toFixed(4) ?? "—"}, {entry.longitude?.toFixed(4) ?? "—"} ·{" "}
                  {new Date(entry.queuedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Everything is up to date. Reports captured offline will appear here.
          </p>
        )}
        <button
          onClick={() => void runSync(true)}
          disabled={syncing || !pending.length}
          className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
          Sync Now
        </button>
      </section>

      <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-bold text-foreground">Cached map area</h2>
        </div>
        <p className="mt-2 font-mono text-sm text-foreground">
          {usage ? formatBytes(usage.usedBytes) : "—"}
          {usage?.quotaBytes ? (
            <span className="text-muted-foreground"> / {formatBytes(usage.quotaBytes)}</span>
          ) : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {usage?.caches.length ?? 0} cached bundle
          {(usage?.caches.length ?? 0) === 1 ? "" : "s"} — app shell, map tiles and local area data.
        </p>

        {confirmClear ? (
          <div className="mt-3 rounded-xl border border-critical/40 bg-background p-3">
            <p className="text-xs text-foreground">
              Clear all cached tiles and app data? Offline browsing will be unavailable until you
              reload areas. Pending reports are kept.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  await clearCaches();
                  setConfirmClear(false);
                  await refresh();
                  toast.success("Cache cleared");
                }}
                className="tap-target flex-1 rounded-lg bg-critical px-3 py-2 text-xs font-semibold text-foreground"
              >
                Clear cache
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="tap-target flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-critical"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear Cache
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold text-foreground">Auto-sync</h2>
        <div className="mt-3 space-y-2">
          {MODES.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setAutoSync(option.value);
                setMode(option.value);
              }}
              aria-pressed={mode === option.value}
              className={`tap-target flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left ${
                mode === option.value ? "border-accent bg-accent/10" : "border-border bg-background"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                  mode === option.value ? "border-accent bg-accent" : "border-border"
                }`}
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
