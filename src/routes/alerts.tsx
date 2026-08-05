import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  MapPin,
  Settings,
  ShieldAlert,
  ThumbsUp,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  NOTIFICATION_LABELS,
  NOTIFICATION_TOKEN,
  fetchNotifications,
  markAllRead,
  markRead,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/roadpulse";

export const Route = createFileRoute("/alerts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alerts & Notifications — RoadPulse" },
      {
        name: "description",
        content:
          "Hazard proximity warnings, authority alerts, repair status updates and AI deterioration predictions.",
      },
      { property: "og:title", content: "Alerts & Notifications — RoadPulse" },
      {
        property: "og:description",
        content: "Stay ahead of road hazards, repairs and predicted deterioration.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsScreen,
});

const TABS = [
  { key: "all", label: "All" },
  { key: "hazard", label: "Hazard" },
  { key: "authority", label: "Authority" },
  { key: "repair", label: "Repair Updates" },
  { key: "prediction", label: "Predictions" },
] as const;

const ICONS: Record<NotificationType, typeof Bell> = {
  hazard: TriangleAlert,
  authority: ShieldAlert,
  repair: Wrench,
  prediction: TrendingUp,
  community: ThumbsUp,
};

function AlertsScreen() {
  const navigate = useNavigate();
  const { user, loading, role } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
    } catch {
      toast.error("Could not load your alerts");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    void load();
    const channel = supabase
      .channel("notifications-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, loading, navigate, load]);

  const visible = useMemo(() => {
    const scoped = role === "citizen" ? items.filter((i) => i.type !== "authority") : items;
    return tab === "all" ? scoped : scoped.filter((i) => i.type === tab);
  }, [items, tab, role]);

  async function open(item: NotificationRow) {
    if (!item.read) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      await markRead([item.id]);
    }
    if (item.report_id) {
      void navigate({ to: "/report/$id", params: { id: item.report_id } });
    } else if (item.latitude != null && item.longitude != null) {
      void navigate({
        to: "/map",
        search: { lat: item.latitude, lng: item.longitude },
      });
    } else {
      void navigate({ to: "/map" });
    }

  }

  return (
    <main className="min-h-[100dvh] bg-background pb-28">
      <header className="glass sticky top-0 z-20 flex items-center gap-3 border-b border-border px-5 py-4">
        <h1 className="flex-1 text-lg font-bold text-foreground">Alerts &amp; Notifications</h1>
        <button
          onClick={async () => {
            if (!user) return;
            setItems((prev) => prev.map((i) => ({ ...i, read: true })));
            await markAllRead(user.id);
            toast.success("All alerts marked read");
          }}
          className="tap-target flex items-center gap-1.5 text-xs font-semibold text-accent"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          Mark All Read
        </button>
        <button
          aria-label="Notification settings"
          onClick={() => navigate({ to: "/settings/notifications" })}
          className="tap-target text-muted-foreground"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${
              tab === t.key
                ? "bg-accent text-accent-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {busy ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading alerts…</p>
      ) : visible.length === 0 ? (
        <section className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
            <BellRing className="h-8 w-8" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            No alerts yet — keep contributing to the community!
          </p>
        </section>
      ) : (
        <ul className="space-y-3 px-5">
          {visible.map((item) => {
            const Icon = ICONS[item.type];
            const token = NOTIFICATION_TOKEN[item.type];
            return (
              <li key={item.id}>
                <button
                  onClick={() => void open(item)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-left"
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${token} 16%, transparent)`,
                      color: token,
                    }}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {item.title}
                      </span>
                      {!item.read ? (
                        <span
                          aria-label="Unread"
                          className="h-2 w-2 shrink-0 rounded-full bg-info"
                        />
                      ) : null}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-semibold">
                        {NOTIFICATION_LABELS[item.type]}
                      </span>
                      {item.location_label ? (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" aria-hidden="true" />
                          {item.location_label}
                        </span>
                      ) : null}
                      <span className="data-mono">{timeAgo(item.created_at)}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <BottomNav />
    </main>
  );
}
