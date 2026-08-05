import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, Loader2, MapPin, Medal, Trophy } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  BADGES,
  displayName,
  fetchLeaderboard,
  fetchMyBadges,
  fetchMyReports,
  fetchPointSummary,
  initials,
  type LeaderboardEntry,
  type LeaderboardScope,
  type PointSummary,
} from "@/lib/gamification";
import { signedPhotoUrls } from "@/lib/reports";
import {
  DAMAGE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TOKEN,
  STATUS_LABELS,
  type ReportRow,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/community")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Community — RoadPulse" },
      {
        name: "description",
        content: "Leaderboards, your reports and achievement badges in the RoadPulse community.",
      },
      { property: "og:title", content: "Community — RoadPulse" },
      { property: "og:description", content: "Climb the leaderboard by reporting road damage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityScreen,
});

const TABS = ["Leaderboard", "My Reports", "Achievements"] as const;
type Tab = (typeof TABS)[number];

const STATUS_FILTERS = ["All", "Pending", "Verified", "Resolved"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function CommunityScreen() {
  const [tab, setTab] = useState<Tab>("Leaderboard");

  return (
    <main className="min-h-[100dvh] bg-background pb-28">
      <header className="glass sticky top-0 z-20 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <h1 className="text-xl font-bold text-foreground">Community</h1>
        <div role="tablist" aria-label="Community sections" className="mt-3 flex gap-1">
          {TABS.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              onClick={() => setTab(item)}
              className={`tap-target flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                tab === item
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {tab === "Leaderboard" ? <LeaderboardTab /> : null}
      {tab === "My Reports" ? <MyReportsTab /> : null}
      {tab === "Achievements" ? <AchievementsTab /> : null}

      <BottomNav />
    </main>
  );
}

/* ---------------------------------- Leaderboard --------------------------------- */

function LeaderboardTab() {
  const { user } = useAuth();
  const [scope, setScope] = useState<LeaderboardScope>("national");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeaderboard(scope)
      .then((data) => active && setRows(data))
      .catch(() => active && setRows([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [scope]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const mine = rows.find((r) => r.user_id === user?.id);

  return (
    <section className="px-5 pt-4">
      <label className="mb-4 block">
        <span className="sr-only">Leaderboard region</span>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as LeaderboardScope)}
          className="tap-target w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold text-foreground"
        >
          <option value="city">My City</option>
          <option value="state">My State</option>
          <option value="national">National</option>
        </select>
      </label>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty text="No contributors here yet — be the first to report." />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 items-end gap-2">
            {[podium[1], podium[0], podium[2]].map((entry, i) => {
              const heights = ["h-20", "h-28", "h-16"];
              const medals = ["🥈", "🥇", "🥉"];
              if (!entry) return <div key={i} />;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col items-center gap-1"
                >
                  <Avatar name={displayName(entry)} url={entry.avatar_url} />
                  <span className="max-w-full truncate text-[11px] font-semibold text-foreground">
                    {displayName(entry)}
                  </span>
                  <div
                    className={`glass flex w-full ${heights[i]} flex-col items-center justify-center rounded-xl`}
                  >
                    <span className="text-lg">{medals[i]}</span>
                    <span className="font-mono text-sm font-bold text-accent">{entry.points}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <ul className="space-y-2">
            {rest.map((entry) => (
              <li
                key={entry.user_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <span className="w-6 font-mono text-sm text-muted-foreground">{entry.rank}</span>
                <Avatar name={displayName(entry)} url={entry.avatar_url} small />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {displayName(entry)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.report_count} report{entry.report_count === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-accent">{entry.points}</span>
              </li>
            ))}
          </ul>

          {mine ? (
            <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+76px)] mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-surface px-3 py-3">
              <Medal className="h-4 w-4 text-accent" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">Your rank</span>
              <span className="ml-auto font-mono text-sm font-bold text-accent">
                #{mine.rank} · {mine.points} pts
              </span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Avatar({ name, url, small }: { name: string; url: string | null; small?: boolean }) {
  const size = small ? "h-8 w-8 text-[11px]" : "h-12 w-12 text-sm";
  if (url) {
    return <img src={url} alt="" className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${size} flex items-center justify-center rounded-full bg-accent/12 font-bold text-accent`}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------------------------- My reports ---------------------------------- */

function MyReportsTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<StatusFilter>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    fetchMyReports(user.id)
      .then(async (rows) => {
        if (!active) return;
        setReports(rows);
        const map: Record<string, string> = {};
        await Promise.all(
          rows.slice(0, 40).map(async (r) => {
            const [url] = await signedPhotoUrls(r.photos.slice(0, 1));
            if (url) map[r.id] = url;
          }),
        );
        if (active) setThumbs(map);
      })
      .catch(() => active && setReports([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  const visible = useMemo(
    () =>
      reports.filter((r) => {
        if (filter === "All") return true;
        if (filter === "Verified") return r.community_verified;
        if (filter === "Resolved") return r.status === "resolved";
        return r.status === "pending";
      }),
    [reports, filter],
  );

  return (
    <section className="px-5 pt-4">
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((chip) => (
          <button
            key={chip}
            onClick={() => setFilter(chip)}
            aria-pressed={filter === chip}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === chip ? "bg-accent text-accent-foreground" : "bg-surface text-muted-foreground"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Empty text="No reports here yet — tap the camera to add one." />
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => navigate({ to: "/report/$id", params: { id: r.id } })}

                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left"
              >
                {thumbs[r.id] ? (
                  <img
                    src={thumbs[r.id]}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.damage_types.map((d) => DAMAGE_LABELS[d]).join(", ") || "Road damage"}
                    </p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${SEVERITY_TOKEN[r.severity]} 18%, transparent)`,
                        color: SEVERITY_TOKEN[r.severity],
                      }}
                    >
                      {SEVERITY_LABELS[r.severity]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.address ?? `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {Math.round(r.confidence)}% confidence · {STATUS_LABELS[r.status]} ·{" "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* --------------------------------- Achievements --------------------------------- */

function AchievementsTab() {
  const { user, profile } = useAuth();
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [points, setPoints] = useState<PointSummary>({ total: 0, weekly: 0 });
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([fetchMyBadges(user.id), fetchPointSummary(user.id), fetchMyReports(user.id)])
      .then(([badges, summary, rows]) => {
        if (!active) return;
        setEarned(badges);
        setPoints(summary);
        setReports(rows);
      })
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  const progressFor = (metric: "reports" | "verified" | "streak") => {
    if (metric === "reports") return reports.length;
    if (metric === "verified") return reports.filter((r) => r.community_verified).length;
    return profile?.streak_days ?? 0;
  };

  if (loading) return <Spinner />;

  return (
    <section className="space-y-4 px-5 pt-4">
      <div className="glass grid grid-cols-3 gap-2 rounded-2xl p-4">
        <Stat label="Total points" value={points.total} />
        <Stat label="This week" value={points.weekly} />
        <div className="text-center">
          <p className="flex items-center justify-center gap-1 font-mono text-lg font-bold text-warning">
            <Flame className="h-4 w-4" aria-hidden="true" />
            {profile?.streak_days ?? 0}
          </p>
          <p className="text-[11px] text-muted-foreground">Day streak</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3">
        {BADGES.map((badge) => {
          const has = earned.has(badge.key);
          const current = Math.min(progressFor(badge.metric), badge.target);
          return (
            <li
              key={badge.key}
              className={`rounded-2xl border border-border bg-surface p-3 ${has ? "" : "opacity-60"}`}
            >
              <span
                aria-hidden="true"
                className={`text-2xl ${has ? "" : "grayscale"}`}
                style={has ? undefined : { filter: "grayscale(1)" }}
              >
                {badge.glyph}
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">{badge.name}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{badge.description}</p>
              {!has ? (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(current / badge.target) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {current}/{badge.target}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-safe">
                  Earned
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-mono text-lg font-bold text-accent">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Trophy className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
