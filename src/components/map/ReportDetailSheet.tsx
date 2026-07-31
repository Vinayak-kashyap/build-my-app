import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Flag, Navigation, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/map/FilterSheet";
import { castVote, signedPhotoUrls } from "@/lib/reports";
import { useAuth } from "@/hooks/useAuth";
import {
  DAMAGE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  formatCoords,
  markerToken,
  timeAgo,
  type ReportRow,
} from "@/lib/roadpulse";

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-moderate/15 text-moderate",
  in_progress: "bg-water/15 text-water",
  resolved: "bg-safe/15 text-safe",
};

export function ReportDetailSheet({
  report,
  myVote,
  onClose,
  onVoted,
}: {
  report: ReportRow;
  myVote: number | undefined;
  onClose: () => void;
  onVoted: (reportId: string, value: number) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const color = markerToken(report);

  useEffect(() => {
    let active = true;
    void signedPhotoUrls(report.photos).then((urls) => active && setPhotos(urls));
    return () => {
      active = false;
    };
  }, [report.photos]);

  async function vote(value: 1 | -1) {
    if (!user) {
      toast.error("Sign in to vote on reports");
      return;
    }
    const next = myVote === value ? 0 : value;
    try {
      await castVote(report.id, user.id, next);
      onVoted(report.id, next);
    } catch {
      toast.error("Could not record your vote");
    }
  }

  return (
    <Sheet onClose={onClose} label="Report details">
      {photos.length ? (
        <div className="relative overflow-hidden rounded-2xl">
          <img
            src={photos[index]}
            alt={`Road damage photo ${index + 1} of ${photos.length}`}
            className="h-52 w-full object-cover"
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
      ) : (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          No photos attached
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {report.damage_types.map((type) => (
          <span
            key={type}
            className="rounded-full bg-surface-elevated px-3 py-1 text-xs font-semibold text-foreground"
          >
            {DAMAGE_LABELS[type]}
          </span>
        ))}
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          {SEVERITY_LABELS[report.severity]}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[report.status]}`}
        >
          {STATUS_LABELS[report.status]}
        </span>
        {report.community_verified ? (
          <span className="flex items-center gap-1 rounded-full bg-safe/15 px-3 py-1 text-xs font-semibold text-safe">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Community Verified
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>AI confidence</span>
          <span className="data-mono text-foreground">{Number(report.confidence).toFixed(0)}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${report.confidence}%`, backgroundColor: color }}
          />
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">GPS</dt>
          <dd className="data-mono text-foreground">
            {formatCoords(report.latitude, report.longitude)}
          </dd>
        </div>
        {report.address ? (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="max-w-[60%] text-right text-foreground">{report.address}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Reports</dt>
          <dd className="data-mono text-foreground">{report.report_count}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="text-foreground">{timeAgo(report.updated_at)}</dd>
        </div>
      </dl>

      {report.ai_suggestion ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            AI repair suggestion
          </p>
          <p className="mt-1.5 text-sm text-foreground">{report.ai_suggestion}</p>
        </div>
      ) : null}

      {report.notes ? (
        <p className="mt-3 text-sm text-muted-foreground">“{report.notes}”</p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <button
          onClick={() => void vote(1)}
          aria-pressed={myVote === 1}
          className={`tap-target flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            myVote === 1 ? "border-safe bg-safe/15 text-safe" : "border-border text-muted-foreground"
          }`}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          {report.upvotes}
        </button>
        <button
          onClick={() => void vote(-1)}
          aria-pressed={myVote === -1}
          className={`tap-target flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            myVote === -1
              ? "border-critical bg-critical/15 text-critical"
              : "border-border text-muted-foreground"
          }`}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          {report.downvotes}
        </button>
      </div>

      <button
        onClick={() =>
          navigate({
            to: "/navigation",
            search: { avoid: report.id, lat: report.latitude, lng: report.longitude },
          })
        }
        className="tap-target mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground"
      >
        <Navigation className="h-4 w-4" aria-hidden="true" />
        Get Directions Avoiding This
      </button>

      <button
        onClick={() => void vote(-1)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-muted-foreground"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report Inaccuracy
      </button>
    </Sheet>
  );
}
