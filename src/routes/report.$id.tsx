import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { castVote, signedPhotoUrls } from "@/lib/reports";
import {
  CIVIC_PORTAL_LABELS,
  CIVIC_STATUS_LABELS,
  fetchCivicSubmissions,
  type CivicSubmission,
} from "@/lib/civic";
import {
  DAMAGE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_TOKEN,
  STATUS_LABELS,
  VEHICLE_LABELS,
  VEHICLES,
  formatCoords,
  markerToken,
  timeAgo,
  type ReportRow,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/report/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Road Damage Report — RoadPulse" },
      {
        name: "description",
        content:
          "Full report detail: photos, severity, AI repair suggestion, confidence, GPS and repair timeline.",
      },
      { property: "og:title", content: "Road Damage Report — RoadPulse" },
      { property: "og:description", content: "See the photos, severity and repair status." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportDetailScreen,
});

const TIMELINE = ["Submitted", "Verified", "In Progress", "Resolved"] as const;

function timelineIndex(report: ReportRow) {
  if (report.status === "resolved") return 3;
  if (report.status === "in_progress") return 2;
  if (report.community_verified) return 1;
  return 0;
}

function ReportDetailScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const { user } = useAuth();

  const [report, setReport] = useState<ReportRow | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [myVote, setMyVote] = useState(0);
  const [submitter, setSubmitter] = useState<string | null>(null);
  const [civic, setCivic] = useState<CivicSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (!active) return;
      const row = (data as ReportRow | null) ?? null;
      setReport(row);
      setLoading(false);
      if (!row) return;
      void signedPhotoUrls(row.photos).then((urls) => active && setPhotos(urls));
      void fetchCivicSubmissions(row.id).then((rows) => active && setCivic(rows));
      void supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", row.user_id)
        .maybeSingle()
        .then(({ data: p }) => {
          if (active) setSubmitter(p?.username ?? p?.full_name ?? null);
        });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("report_votes")
      .select("value")
      .eq("report_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => active && setMyVote(data?.value ?? 0));
    return () => {
      active = false;
    };
  }, [id, user]);

  async function vote(value: 1 | -1) {
    if (!user) {
      toast.error("Sign in to vote on reports");
      return;
    }
    if (!report) return;
    const next = myVote === value ? 0 : value;
    try {
      await castVote(report.id, user.id, next);
      setMyVote(next);
      toast.success(next === 0 ? "Vote removed" : "Thanks for verifying");
    } catch {
      toast.error("Could not record your vote");
    }
  }

  async function share() {
    const url = `${window.location.origin}/report/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: "RoadPulse report", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background text-sm text-muted-foreground">
        Loading report…
      </main>
    );
  }

  if (!report) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Report not found</h1>
        <p className="text-sm text-muted-foreground">
          This report may have been removed or flagged by the community.
        </p>
        <button
          onClick={() => navigate({ to: "/map" })}
          className="tap-target rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground"
        >
          Back to map
        </button>
      </main>
    );
  }

  const color = markerToken(report);
  const step = timelineIndex(report);
  const confidence = Math.round(Number(report.confidence));

  return (
    <main className="min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.history.back()}
          aria-label="Go back"
          className="tap-target rounded-xl border border-border p-2 text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h1 className="flex-1 truncate text-base font-bold text-foreground">
          {report.address ?? "Unnamed road"}
        </h1>
        <button
          onClick={() => void share()}
          aria-label="Share report"
          className="tap-target rounded-xl border border-border p-2 text-foreground"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {photos.length ? (
        <div className="relative">
          <img
            src={photos[index]}
            alt={`Road damage photo ${index + 1} of ${photos.length}`}
            className="h-64 w-full object-cover"
          />
          {photos.length > 1 ? (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {photos.map((p, i) => (
                <button
                  key={p}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-accent" : "w-1.5 bg-foreground/40"}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="space-y-4 px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {report.damage_types.map((d) => (
            <span
              key={d}
              className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-foreground"
            >
              {DAMAGE_LABELS[d]}
            </span>
          ))}
          <span
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
          >
            {SEVERITY_LABELS[report.severity]}
          </span>
          {report.community_verified ? (
            <span className="flex items-center gap-1 rounded-full bg-safe/15 px-3 py-1 text-xs font-bold text-safe">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Community Verified
            </span>
          ) : null}
        </div>

        <div className="flex gap-2">
          {VEHICLES.map((vehicle) => {
            const level =
              (vehicle === "bike" ? report.bike_severity : report.car_severity) ?? report.severity;
            return (
              <div
                key={vehicle}
                className="flex-1 rounded-xl px-3 py-2"
                style={{
                  background: `color-mix(in srgb, ${SEVERITY_TOKEN[level]} 14%, transparent)`,
                }}
              >
                <p className="text-[11px] text-muted-foreground">{VEHICLE_LABELS[vehicle]}</p>
                <p className="text-sm font-bold" style={{ color: SEVERITY_TOKEN[level] }}>
                  {SEVERITY_LABELS[level]} risk
                </p>
              </div>
            );
          })}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Confidence score</span>
            <span className="font-mono text-foreground">{confidence}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-accent" style={{ width: `${confidence}%` }} />
          </div>
        </div>

        {report.ai_suggestion ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold text-accent">AI Repair Suggestion</h2>
            <p className="mt-1 text-sm text-foreground">{report.ai_suggestion}</p>
            {report.ai_summary ? (
              <p className="mt-2 text-xs text-muted-foreground">{report.ai_summary}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="flex-1 font-mono text-xs text-foreground">
            {formatCoords(report.latitude, report.longitude)}
          </span>
          <button
            onClick={() =>
              navigate({
                to: "/map",
                search: { lat: report.latitude, lng: report.longitude },
              })
            }
            className="tap-target rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
          >
            View on Map
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Reported {timeAgo(report.created_at)} by {submitter ? `@${submitter}` : "an anonymous contributor"}
        </p>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-foreground">Repair Timeline</h2>
          <ol className="space-y-3">
            {TIMELINE.map((label, i) => (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`}
                  aria-hidden="true"
                />
                <span
                  className={`text-sm ${i <= step ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
                {i === step ? (
                  <span className="ml-auto text-[11px] text-accent">
                    {STATUS_LABELS[report.status]}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        {civic.length ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-1 text-sm font-bold text-foreground">Civic Complaints</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Filed automatically with Lucknow civic bodies on your behalf.
            </p>
            <ul className="space-y-2">
              {civic.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-xl bg-surface-elevated px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {CIVIC_PORTAL_LABELS[row.portal] ?? row.portal}
                    </p>
                    {row.complaint_number ? (
                      <p className="data-mono text-xs text-accent">#{row.complaint_number}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {row.error_message ?? "Awaiting a complaint number"}
                      </p>
                    )}
                    {row.tracking_url ? (
                      <a
                        href={row.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-accent"
                      >
                        Track complaint
                      </a>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {CIVIC_STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-foreground">Community Reactions</h2>
          <div className="flex gap-3">
            <button
              onClick={() => void vote(1)}
              className={`tap-target flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${myVote === 1 ? "border-safe bg-safe/15 text-safe" : "border-border text-foreground"}`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" /> {report.upvotes}
            </button>
            <button
              onClick={() => void vote(-1)}
              className={`tap-target flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${myVote === -1 ? "border-critical bg-critical/15 text-critical" : "border-border text-foreground"}`}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" /> {report.downvotes}
            </button>
          </div>
        </div>

        {report.notes || report.tags.length ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-bold text-foreground">Notes</h2>
            {report.notes ? (
              <p className="text-sm text-foreground">{report.notes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No notes provided.</p>
            )}
            {report.tags.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {report.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
