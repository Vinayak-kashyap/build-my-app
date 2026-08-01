import { motion } from "framer-motion";
import { CloudRain, Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { RISK_LABELS, riskToken, type DigestRow, type PredictionRow } from "@/lib/predictions";
import { timeAgo } from "@/lib/roadpulse";

type Props = {
  predictions: PredictionRow[];
  digest: DigestRow | null;
  canForecast: boolean;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
  onFocus: (prediction: PredictionRow) => void;
};

export function PredictionSheet({
  predictions,
  digest,
  canForecast,
  generating,
  onGenerate,
  onClose,
  onFocus,
}: Props) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      role="dialog"
      aria-label="Predicted road deterioration"
      className="glass absolute inset-x-0 bottom-0 z-[950] max-h-[80dvh] overflow-y-auto rounded-t-3xl p-4 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-sheet"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Roads At Risk</h2>
          <p className="text-xs text-muted-foreground">
            AI deterioration forecast from report history, rainfall and traffic load.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close prediction panel"
          className="tap-target flex items-center justify-center text-muted-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {digest ? (
        <div className="mt-3 rounded-2xl border border-moderate/40 bg-moderate/10 p-3">
          <p className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-moderate" aria-hidden="true" />
            {digest.headline}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{digest.narrative}</p>
          <p className="data-mono mt-1 text-[11px] text-muted-foreground">
            {digest.period} briefing · {timeAgo(digest.created_at)}
          </p>
        </div>
      ) : null}

      {predictions[0]?.weather_summary ? (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <CloudRain className="mt-0.5 h-4 w-4 shrink-0 text-water" aria-hidden="true" />
          {predictions[0].weather_summary}
        </p>
      ) : null}

      {predictions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No active forecast yet. Predictions appear once enough reports exist for an area.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {predictions.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => onFocus(p)}
                className="w-full rounded-2xl border border-border bg-surface-elevated p-3 text-left"
              >
                <div className="flex items-start gap-2">
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: riskToken(p.risk_level) }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {p.address ?? `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                    </p>
                    <p
                      className="data-mono text-xs font-semibold"
                      style={{ color: riskToken(p.risk_level) }}
                    >
                      {RISK_LABELS[p.risk_level]} · {p.risk_score}% · next {p.window_days} days
                    </p>
                    {p.predicted_damage ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Likely: {p.predicted_damage}
                      </p>
                    ) : null}
                    {p.rationale ? (
                      <p className="mt-1 text-xs text-muted-foreground">{p.rationale}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canForecast ? (
        <button
          onClick={onGenerate}
          disabled={generating}
          className="tap-target mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-accent-foreground disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {generating ? "Forecasting deterioration..." : "Run AI forecast for this area"}
        </button>
      ) : null}
    </motion.div>
  );
}
