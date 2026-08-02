import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  ALERT_RADII,
  DEFAULT_SETTINGS,
  fetchSettings,
  pushPermission,
  requestPushPermission,
  saveSettings,
  type NotificationSettings,
} from "@/lib/notifications";

export const Route = createFileRoute("/settings/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notification Settings — RoadPulse" },
      {
        name: "description",
        content:
          "Control hazard proximity alerts, alert radius, repair updates, prediction warnings and email digests.",
      },
      { property: "og:title", content: "Notification Settings — RoadPulse" },
      { property: "og:description", content: "Tune how RoadPulse alerts you on the road." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationSettingsScreen,
});

type ToggleKey = Exclude<keyof NotificationSettings, "user_id" | "alert_radius_m">;

const TOGGLES: { key: ToggleKey; label: string; hint: string; authorityOnly?: boolean }[] = [
  {
    key: "hazard_proximity",
    label: "Hazard Proximity Alerts",
    hint: "Warn me when I approach a critical or moderate hazard",
  },
  {
    key: "authority_alerts",
    label: "Authority Report Alerts",
    hint: "New critical reports and verification thresholds in my jurisdiction",
    authorityOnly: true,
  },
  { key: "repair_updates", label: "Repair Status Updates", hint: "When my reports change status" },
  {
    key: "prediction_warnings",
    label: "Prediction Warnings",
    hint: "AI forecasts for roads I travel on",
  },
  {
    key: "vote_activity",
    label: "Community Vote Activity",
    hint: "Upvotes and disputes on my reports",
  },
  {
    key: "weekly_digest_email",
    label: "Weekly Community Digest (email)",
    hint: "A weekly summary of road health in my region",
  },
];

function NotificationSettingsScreen() {
  const navigate = useNavigate();
  const { user, loading, role } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    setPermission(pushPermission());
    void fetchSettings(user.id)
      .then(setSettings)
      .catch(() => setSettings({ user_id: user.id, ...DEFAULT_SETTINGS }));
  }, [user, loading, navigate]);

  async function patch(next: Partial<NotificationSettings>) {
    if (!user || !settings) return;
    const merged = { ...settings, ...next };
    setSettings(merged);
    try {
      await saveSettings(user.id, merged);
    } catch {
      toast.error("Could not save your preferences");
    }
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-16">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          aria-label="Back to profile"
          onClick={() => navigate({ to: "/profile" })}
          className="tap-target text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Notification Settings</h1>
      </header>

      {!settings ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4 px-5 py-5">
          {permission !== "granted" ? (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent">
                  <BellRing className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Push notifications</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Browser permission:{" "}
                    <span className="data-mono text-foreground">{permission}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const result = await requestPushPermission();
                  setPermission(result);
                  if (result === "granted") toast.success("Push notifications enabled");
                  else if (result === "denied")
                    toast.error("Blocked — enable notifications in your browser settings");
                }}
                className="tap-target mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
              >
                Enable Push Notifications
              </button>
            </section>
          ) : null}

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {TOGGLES.filter((t) => !t.authorityOnly || role !== "citizen").map((t) => (
              <li key={t.key} className="flex items-center gap-4 px-4 py-3.5">
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{t.hint}</span>
                </span>
                <button
                  role="switch"
                  aria-checked={settings[t.key]}
                  aria-label={t.label}
                  onClick={() => void patch({ [t.key]: !settings[t.key] })}
                  className={`tap-target relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    settings[t.key] ? "bg-accent" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${
                      settings[t.key] ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ul>

          <section
            className={`rounded-2xl border border-border bg-surface p-4 ${
              settings.hazard_proximity ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Alert Radius</p>
              <span className="data-mono text-sm text-accent">
                {settings.alert_radius_m >= 1000
                  ? `${settings.alert_radius_m / 1000} km`
                  : `${settings.alert_radius_m} m`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={ALERT_RADII.length - 1}
              step={1}
              disabled={!settings.hazard_proximity}
              aria-label="Alert radius"
              value={Math.max(0, ALERT_RADII.indexOf(settings.alert_radius_m as 500))}
              onChange={(e) =>
                void patch({ alert_radius_m: ALERT_RADII[Number(e.target.value)] })
              }
              className="mt-4 w-full accent-[var(--accent)]"
            />
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              {ALERT_RADII.map((r) => (
                <span key={r} className="data-mono">
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
