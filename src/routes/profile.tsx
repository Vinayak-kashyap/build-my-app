import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  CloudOff,
  Download,
  Globe,
  Palette,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Radar,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import { BADGES, initials } from "@/lib/gamification";
import {
  changePassword,
  fetchProfileStats,
  fetchRecentBadges,
  signedAvatarUrl,
  type ProfileStats,
} from "@/lib/profile";
import { ALERT_RADII, fetchSettings, saveSettings } from "@/lib/notifications";
import { fetchMyReports } from "@/lib/gamification";
import { downloadMyReportsPdf } from "@/lib/report-export";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Profile — RoadPulse" },
      {
        name: "description",
        content: "Your RoadPulse contribution stats, badges, alert radius and account settings.",
      },
      { property: "og:title", content: "Your Profile — RoadPulse" },
      { property: "og:description", content: "Track your reports, points, rank and badges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileScreen,
});

const ROLE_LABEL: Record<string, string> = {
  citizen: "Citizen",
  authority: "Authority",
  admin: "Admin",
};

function radiusLabel(m: number) {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`;
}

function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, user, role, signOut } = useAuth();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [recent, setRecent] = useState<{ badge_key: string; earned_at: string }[]>([]);
  const [radius, setRadius] = useState(500);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const [s, badges, settings, url] = await Promise.all([
        fetchProfileStats(user.id).catch(() => null),
        fetchRecentBadges(user.id).catch(() => []),
        fetchSettings(user.id).catch(() => null),
        signedAvatarUrl(profile?.avatar_url ?? null).catch(() => null),
      ]);
      if (!active) return;
      setStats(s);
      setRecent(badges);
      if (settings) setRadius(settings.alert_radius_m);
      setAvatar(url);
    })();
    return () => {
      active = false;
    };
  }, [user, profile?.avatar_url]);

  const updateRadius = useCallback(
    async (value: number) => {
      setRadius(value);
      if (!user) return;
      try {
        await saveSettings(user.id, { alert_radius_m: value });
        toast.success(`Alert radius set to ${radiusLabel(value)}`);
      } catch {
        toast.error("Could not save alert radius");
      }
    },
    [user],
  );

  async function onChangePassword() {
    const next = window.prompt("Enter a new password (min 8 characters)");
    if (!next) return;
    if (next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      await changePassword(next);
      toast.success("Password updated");
    } catch {
      toast.error("Could not update password");
    }
  }

  async function onExport() {
    if (!user) return;
    setExporting(true);
    try {
      const reports = await fetchMyReports(user.id);
      if (!reports.length) {
        toast.info("You have no reports to export yet");
        return;
      }
      downloadMyReportsPdf(reports, profile?.full_name ?? user.email ?? "RoadPulse user");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteMyAccount({ data: undefined });
      await signOut();
      toast.success("Account deleted");
      void navigate({ to: "/login", replace: true });
    } catch {
      toast.error("Could not delete your account");
      setDeleting(false);
    }
  }

  const name = profile?.full_name ?? user?.email ?? "Your profile";
  const statCards = [
    { label: "Reports", value: stats?.reports ?? 0 },
    { label: "Points", value: stats?.points ?? 0 },
    { label: "Rank", value: stats?.rank ? `#${stats.rank}` : "—" },
    { label: "Badges", value: stats?.badges ?? 0 },
  ];

  return (
    <main className="min-h-[100dvh] bg-background pb-28">
      <header className="flex items-center gap-4 px-6 pt-12">
        {avatar ? (
          <img
            src={avatar}
            alt={`${name} avatar`}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/12 text-lg font-bold text-accent">
            {profile?.full_name ? initials(profile.full_name) : <UserRound className="h-7 w-7" />}
          </span>
        )}
        <div className="min-w-0 flex-1 text-left">
          <h1 className="truncate text-xl font-bold text-foreground">{name}</h1>
          {profile?.username ? (
            <p className="truncate text-sm text-muted-foreground">@{profile.username}</p>
          ) : null}
          <span className="mt-1 inline-block rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            {ROLE_LABEL[role] ?? role}
          </span>
        </div>
        <Link
          to="/profile/edit"
          className="tap-target rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground"
        >
          Edit
        </Link>
      </header>

      <section aria-label="Your stats" className="mt-5 grid grid-cols-4 gap-2 px-6">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface px-2 py-3">
            <p className="text-lg font-bold text-foreground">{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </section>

      <section aria-label="Recent badges" className="mt-6 px-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Recent Badges</h2>
        {recent.length ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {recent.map((b) => {
              const def = BADGES.find((d) => d.key === b.badge_key);
              return (
                <div
                  key={b.badge_key}
                  className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-xl border border-border bg-surface px-2 py-3 text-center"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {def?.glyph ?? "🏅"}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {def?.name ?? b.badge_key}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No badges yet — submit your first report to unlock one.
          </p>
        )}
      </section>

      <section aria-label="Account settings" className="mt-6 space-y-2 px-6">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Account Settings</h2>
        <ListItem
          icon={<UserRound className="h-4 w-4 text-accent" />}
          label="Edit Profile"
          onClick={() => navigate({ to: "/profile/edit" })}
        />
        <ListItem
          icon={<Bell className="h-4 w-4 text-accent" />}
          label="Notification Preferences"
          onClick={() => navigate({ to: "/settings/notifications" })}
        />

        <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Radar className="h-4 w-4 text-accent" aria-hidden="true" />
            <span className="flex-1 text-sm font-semibold text-foreground">Alert Radius</span>
            <span className="font-mono text-xs text-accent">{radiusLabel(radius)}</span>
          </div>
          <input
            type="range"
            aria-label="Alert radius"
            min={0}
            max={ALERT_RADII.length - 1}
            step={1}
            value={Math.max(0, ALERT_RADII.indexOf(radius as (typeof ALERT_RADII)[number]))}
            onChange={(e) => void updateRadius(ALERT_RADII[Number(e.target.value)])}
            className="mt-3 w-full accent-[var(--accent)]"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            {ALERT_RADII.map((r) => (
              <span key={r}>{radiusLabel(r)}</span>
            ))}
          </div>
        </div>

        <ListItem
          icon={<CloudOff className="h-4 w-4 text-accent" />}
          label="Offline Data Management"
          onClick={() => navigate({ to: "/settings/offline" })}
        />
        <ListItem
          icon={<KeyRound className="h-4 w-4 text-accent" />}
          label="Change Password"
          onClick={() => void onChangePassword()}
        />
        <ListItem
          icon={<Palette className="h-4 w-4 text-accent" />}
          label="Appearance & Theme"
          value="Dark / Bright / Auto"
          onClick={() => navigate({ to: "/settings/appearance" })}
        />
        <ListItem
          icon={<Globe className="h-4 w-4 text-accent" />}
          label="Language / Region"
          value={profile?.region ?? "Not set"}
          onClick={() => navigate({ to: "/settings/language" })}
        />
        <ListItem
          icon={<ShieldCheck className="h-4 w-4 text-accent" />}
          label="Privacy Settings"
          value="Anonymised reports"
          onClick={() => navigate({ to: "/settings/notifications" })}
        />
      </section>

      {role === "authority" || role === "admin" ? (
        <section aria-label="Authority tools" className="mt-6 space-y-2 px-6">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Authority</h2>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="tap-target flex w-full items-center gap-3 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Go to Authority Dashboard
          </button>
          <ListItem
            icon={<Download className="h-4 w-4 text-accent" />}
            label={exporting ? "Preparing PDF…" : "Download My Reports (PDF)"}
            onClick={() => void onExport()}
          />
        </section>
      ) : null}

      <section aria-label="Danger zone" className="mt-8 px-6">
        <h2 className="mb-2 text-sm font-semibold text-critical">Danger Zone</h2>
        <button
          onClick={() => setConfirmDelete(true)}
          className="tap-target flex w-full items-center gap-3 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3.5 text-sm font-semibold text-critical"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete Account
        </button>
      </section>

      <div className="mt-6 flex justify-center px-6">
        <button
          onClick={async () => {
            await signOut();
            toast.success("Signed out");
            void navigate({ to: "/login", replace: true });
          }}
          className="tap-target flex items-center justify-center gap-2 rounded-xl border border-critical/40 bg-critical/10 px-6 py-3 text-sm font-semibold text-critical"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign Out
        </button>
      </div>

      {confirmDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm account deletion"
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 px-6 backdrop-blur"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
            <h3 className="text-base font-bold text-foreground">Delete your account?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes your profile, reports, points and badges. This cannot be
              undone.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="tap-target flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={() => void onDelete()}
                className="tap-target flex-1 rounded-xl bg-critical px-4 py-3 text-sm font-semibold text-foreground disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}

function ListItem({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tap-target flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left text-sm font-semibold text-foreground"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {value ? <span className="text-xs text-muted-foreground">{value}</span> : null}
      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
