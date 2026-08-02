import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Download,
  FileText,
  Map as MapIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoadMap } from "@/components/map/RoadMap";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAuthorityAlerts,
  fetchKpis,
  fetchRepairQueue,
  updateRepairStatus,
  urgencyBand,
  type DashboardKpis,
  type QueueRow,
} from "@/lib/dashboard";
import { markReviewed, type NotificationRow } from "@/lib/notifications";
import { fetchLatestDigest, fetchPredictions, type PredictionRow } from "@/lib/predictions";
import { downloadQueueCsv, downloadQueuePdf } from "@/lib/report-export";
import { signedPhotoUrls } from "@/lib/reports";
import {
  DAMAGE_LABELS,
  DAMAGE_TYPES,
  REPAIR_STATUSES,
  SEVERITY_LABELS,
  STATUS_LABELS,
  formatCoords,
  markerToken,
  timeAgo,
  type RepairStatus,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Authority Dashboard — RoadPulse" },
      {
        name: "description",
        content:
          "Smart city dashboard: KPI panels, AI-ranked priority repair queue, prediction alerts and PDF reporting.",
      },
      { property: "og:title", content: "Authority Dashboard — RoadPulse" },
      {
        property: "og:description",
        content: "Prioritise road repairs with AI severity, crowd confidence and predicted urgency.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardScreen,
});

type SortKey = "rank" | "severity" | "reports" | "confidence" | "status";

const SEV_ORDER = { critical: 3, moderate: 2, minor: 1 } as const;

function DashboardScreen() {
  const navigate = useNavigate();
  const { user, profile, role, loading } = useAuth();
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [alerts, setAlerts] = useState<NotificationRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [digest, setDigest] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("rank");
  const [detail, setDetail] = useState<QueueRow | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  const isAuthority = role === "authority" || role === "admin";
  const jurisdiction = profile?.region ?? "All jurisdictions";

  const load = useCallback(async () => {
    if (!user) return;
    const [q, k, a, p, d] = await Promise.all([
      fetchRepairQueue(),
      fetchKpis(user.id),
      fetchAuthorityAlerts(user.id),
      fetchPredictions(),
      fetchLatestDigest(),
    ]);
    setQueue(q);
    setKpis(k);
    setAlerts(a as NotificationRow[]);
    setPredictions(p);
    setDigest(d?.headline ?? null);
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    if (!isAuthority) {
      void navigate({ to: "/map", replace: true });
      return;
    }
    void load().catch(() => toast.error("Could not load dashboard data"));
  }, [user, loading, isAuthority, navigate, load]);

  const active = useMemo(() => queue.filter((r) => r.status !== "resolved"), [queue]);

  const sorted = useMemo(() => {
    const list = [...active];
    if (sort === "severity") list.sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
    else if (sort === "reports") list.sort((a, b) => b.report_count - a.report_count);
    else if (sort === "confidence")
      list.sort((a, b) => Number(b.confidence) - Number(a.confidence));
    else if (sort === "status") list.sort((a, b) => a.status.localeCompare(b.status));
    else list.sort((a, b) => Number(b.priority_score) - Number(a.priority_score));
    return list;
  }, [active, sort]);

  const chartData = useMemo(
    () =>
      DAMAGE_TYPES.map((type) => ({
        name: DAMAGE_LABELS[type].split(" ")[0],
        reports: active.filter((r) => r.damage_types.includes(type)).length,
      })).filter((d) => d.reports > 0),
    [active],
  );

  async function setStatus(row: QueueRow, status: RepairStatus) {
    if (!user) return;
    setQueue((prev) =>
      prev.map((r) => (r.id === row.id ? ({ ...r, status } as QueueRow) : r)),
    );
    try {
      await updateRepairStatus(row.id, status, user.id);
      toast.success(`Marked ${STATUS_LABELS[status]}`);
      void load();
    } catch {
      toast.error("Could not update the repair status");
    }
  }

  if (!isAuthority) return null;

  const kpiCards = [
    { label: "Total Active Reports", value: kpis?.activeReports ?? 0, token: "var(--accent)" },
    { label: "Critical Roads", value: kpis?.criticalRoads ?? 0, token: "var(--critical)" },
    { label: "Repaired This Month", value: kpis?.repairedThisMonth ?? 0, token: "var(--safe)" },
    {
      label: "Avg Confidence",
      value: `${kpis?.avgConfidence ?? 0}%`,
      token: "var(--water)",
    },
    { label: "Pending Alerts", value: kpis?.pendingAlerts ?? 0, token: "var(--moderate)" },
  ];

  return (
    <main className="min-h-[100dvh] bg-background pb-16">
      <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b border-border px-5 py-4">
        <button
          aria-label="Back to profile"
          onClick={() => navigate({ to: "/profile" })}
          className="tap-target text-muted-foreground"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-foreground">RoadPulse Dashboard</h1>
          <p className="truncate text-xs text-muted-foreground">{jurisdiction}</p>
        </div>
        <button
          aria-label="Alerts"
          onClick={() => navigate({ to: "/alerts" })}
          className="tap-target relative text-muted-foreground"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {kpis?.pendingAlerts ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-foreground">
              {kpis.pendingAlerts}
            </span>
          ) : null}
        </button>
      </header>

      {/* KPI cards */}
      <section aria-label="Key metrics" className="px-5 pt-5">
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
          {kpiCards.map((c) => (
            <div
              key={c.label}
              className="min-w-[150px] flex-1 rounded-2xl border border-border bg-surface p-4"
            >
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="data-mono mt-2 text-2xl font-bold" style={{ color: c.token }}>
                {c.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Priority repair queue */}
      <section aria-label="Priority repair queue" className="px-5 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-sm font-bold uppercase tracking-wide text-foreground">
            Priority Repair Queue
          </h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground"
            >
              <option value="rank">Priority rank</option>
              <option value="severity">Severity</option>
              <option value="reports">Reports</option>
              <option value="confidence">Confidence</option>
              <option value="status">Status</option>
            </select>
          </label>
          <button
            onClick={() => downloadQueuePdf(sorted, jurisdiction, "Active queue")}
            className="tap-target flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download Full Queue (PDF)
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No active reports in this jurisdiction yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {sorted.map((row, i) => {
              const band = urgencyBand(Number(row.priority_score));
              const color = markerToken(row);
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-border bg-surface p-3.5 md:flex md:items-center md:gap-4"
                >
                  <button
                    onClick={() => setDetail(row)}
                    className="min-w-0 flex-1 text-left"
                    aria-label={`Open report at ${row.address ?? "unnamed road"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="data-mono rounded-lg bg-surface-elevated px-2 py-0.5 text-xs font-bold text-accent">
                        #{i + 1}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {row.address ?? formatCoords(row.latitude, row.longitude)}
                      </span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-muted-foreground">
                        {row.damage_types.map((d) => DAMAGE_LABELS[d]).join(", ")}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 font-bold"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
                          color,
                        }}
                      >
                        {SEVERITY_LABELS[row.severity]}
                      </span>
                      <span className="data-mono text-muted-foreground">
                        {row.report_count} reports
                      </span>
                      <span className="data-mono text-muted-foreground">
                        {Math.round(Number(row.confidence))}% conf.
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 font-bold"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${band.token} 18%, transparent)`,
                          color: band.token,
                        }}
                      >
                        {band.label} urgency
                      </span>
                    </span>
                  </button>
                  <select
                    aria-label={`Repair status for ${row.address ?? "report"}`}
                    value={row.status}
                    onChange={(e) => void setStatus(row, e.target.value as RepairStatus)}
                    className="mt-3 w-full rounded-lg border border-border bg-surface-elevated px-2 py-2 text-xs font-semibold text-foreground md:mt-0 md:w-36"
                  >
                    {REPAIR_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Prediction alerts */}
      <section aria-label="Prediction alerts" className="px-5 pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Prediction Alerts
        </h2>
        {digest ? <p className="mt-1 text-xs text-muted-foreground">{digest}</p> : null}
        {predictions.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No active forecasts — run an AI forecast from the map.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {predictions.slice(0, 8).map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {p.address ?? formatCoords(p.latitude, p.longitude)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {p.rationale ?? p.predicted_damage ?? "Deterioration expected."}
                  </p>
                  <p className="data-mono mt-1 text-[11px] text-moderate">
                    Risk {Math.round(p.risk_score)} · {p.window_days}d
                    {p.weather_summary ? ` · ${p.weather_summary}` : ""}
                  </p>
                </div>
                <button
                  onClick={() =>
                    navigate({ to: "/map", search: { lat: p.latitude, lng: p.longitude } })
                  }
                  className="tap-target shrink-0 text-xs font-semibold text-accent"
                >
                  View on Map
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent authority alerts */}
      <section aria-label="Recent authority alerts" className="px-5 pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Recent Authority Alerts
        </h2>
        {alerts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No authority alerts yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alerts.slice(0, 8).map((a) => (
              <li key={a.id} className="rounded-2xl border border-border bg-surface p-3.5">
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                {a.body ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                ) : null}
                <p className="data-mono mt-1 text-[11px] text-muted-foreground">
                  {a.latitude != null && a.longitude != null
                    ? formatCoords(a.latitude, a.longitude)
                    : "—"}{" "}
                  · {timeAgo(a.created_at)}
                </p>
                {!a.reviewed ? (
                  <button
                    onClick={async () => {
                      setAlerts((prev) =>
                        prev.map((x) => (x.id === a.id ? { ...x, reviewed: true } : x)),
                      );
                      await markReviewed(a.id);
                    }}
                    className="tap-target mt-2 flex items-center gap-1.5 text-xs font-semibold text-accent"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Mark Reviewed
                  </button>
                ) : (
                  <span className="mt-2 inline-block text-xs font-semibold text-safe">Reviewed</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mini map */}
      <section aria-label="Jurisdiction map" className="px-5 pt-6">
        <div className="flex items-center gap-3">
          <h2 className="flex-1 text-sm font-bold uppercase tracking-wide text-foreground">
            Jurisdiction Map
          </h2>
          <button
            onClick={() => navigate({ to: "/map" })}
            className="tap-target flex items-center gap-1.5 text-xs font-semibold text-accent"
          >
            <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Open Full Map
          </button>
        </div>
        <div className="mt-3 h-64 overflow-hidden rounded-2xl border border-border">
          <RoadMap
            reports={active}
            layer="standard"
            center={
              active.length ? [active[0].latitude, active[0].longitude] : [12.9716, 77.5946]
            }
            userPosition={null}
            recenterKey={active.length}
            onSelect={(r) => setDetail(r as QueueRow)}
            predictions={predictions}
          />
        </div>
      </section>

      {/* Health heatmap summary */}
      <section aria-label="Infrastructure health summary" className="px-5 pt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          Infrastructure Health by Damage Category
        </h2>
        <div className="mt-3 h-56 rounded-2xl border border-border bg-surface p-3">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="reports" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No active reports to chart yet.
            </p>
          )}
        </div>
      </section>

      <div className="px-5 py-6">
        <button
          onClick={() => setBuilderOpen(true)}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Generate Report
        </button>
      </div>

      {detail ? (
        <ReportModal row={detail} onClose={() => setDetail(null)} onStatus={setStatus} />
      ) : null}
      {builderOpen ? (
        <ReportBuilder
          queue={queue}
          jurisdiction={jurisdiction}
          onClose={() => setBuilderOpen(false)}
        />
      ) : null}
    </main>
  );
}

function ReportModal({
  row,
  onClose,
  onStatus,
}: {
  row: QueueRow;
  onClose: () => void;
  onStatus: (row: QueueRow, status: RepairStatus) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const band = urgencyBand(Number(row.priority_score));

  useEffect(() => {
    let active = true;
    void signedPhotoUrls(row.photos).then((urls) => active && setPhotos(urls));
    return () => {
      active = false;
    };
  }, [row.photos]);

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close report detail"
        onClick={onClose}
        className="absolute inset-0 bg-background/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Report detail"
        className="glass relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-lg sm:rounded-3xl"
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="tap-target absolute right-3 top-3 text-muted-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h3 className="pr-8 text-lg font-bold text-foreground">
          {row.address ?? formatCoords(row.latitude, row.longitude)}
        </h3>
        {photos.length ? (
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
            {photos.map((p, i) => (
              <img
                key={p}
                src={p}
                alt={`Damage photo ${i + 1}`}
                className="h-32 w-44 shrink-0 rounded-xl object-cover"
              />
            ))}
          </div>
        ) : null}
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="GPS" value={formatCoords(row.latitude, row.longitude)} mono />
          <Row label="Damage" value={row.damage_types.map((d) => DAMAGE_LABELS[d]).join(", ")} />
          <Row label="Severity" value={SEVERITY_LABELS[row.severity]} />
          <Row label="Reports" value={String(row.report_count)} mono />
          <Row label="Crowd confidence" value={`${Math.round(Number(row.confidence))}%`} mono />
          <Row label="Predicted urgency" value={band.label} />
          <Row label="Priority score" value={String(Math.round(Number(row.priority_score)))} mono />
          <Row label="Reported" value={timeAgo(row.created_at)} />
        </dl>
        {row.ai_suggestion ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              AI repair suggestion
            </p>
            <p className="mt-1.5 text-sm text-foreground">{row.ai_suggestion}</p>
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          {REPAIR_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => onStatus(row, s)}
              aria-pressed={row.status === s}
              className={`tap-target flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                row.status === s
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted-foreground"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => downloadQueuePdf([row], row.address ?? "Report", "Single report")}
          className="tap-target mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
        >
          Download structured report (PDF)
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`max-w-[60%] text-right text-foreground ${mono ? "data-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ReportBuilder({
  queue,
  jurisdiction,
  onClose,
}: {
  queue: QueueRow[];
  jurisdiction: string;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const filtered = useMemo(
    () =>
      queue.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= new Date(from).getTime() && t <= new Date(to).getTime() + 86400_000;
      }),
    [queue, from, to],
  );

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close report builder"
        onClick={onClose}
        className="absolute inset-0 bg-background/75 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Generate report"
        className="glass relative w-full rounded-t-3xl p-5 sm:max-w-md sm:rounded-3xl"
      >
        <h3 className="text-lg font-bold text-foreground">Generate Report</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered.length} reports in the selected range
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              downloadQueuePdf(filtered, jurisdiction, `${from} → ${to}`);
              onClose();
            }}
            className="tap-target flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
          >
            PDF
          </button>
          <button
            onClick={() => {
              downloadQueueCsv(filtered);
              onClose();
            }}
            className="tap-target flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground"
          >
            CSV
          </button>
        </div>
        <button
          onClick={onClose}
          className="tap-target mt-3 w-full text-xs font-semibold text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
