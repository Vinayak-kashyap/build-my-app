import { motion } from "framer-motion";
import {
  DAMAGE_LABELS,
  DAMAGE_TYPES,
  SEVERITIES,
  SEVERITY_LABELS,
  type DamageType,
  type Severity,
} from "@/lib/roadpulse";
import type { ReportFilters } from "@/lib/reports";
import { DEFAULT_FILTERS } from "@/lib/reports";
import { useState } from "react";
import { X } from "lucide-react";

const RANGES = [
  { label: "24h", hours: 24 },
  { label: "7d", hours: 24 * 7 },
  { label: "30d", hours: 24 * 30 },
  { label: "All", hours: null },
] as const;

export function FilterSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: ReportFilters;
  onApply: (next: ReportFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ReportFilters>(filters);
  const allDamage = draft.damageTypes.length === 0;

  const toggleDamage = (type: DamageType) =>
    setDraft((d) => ({
      ...d,
      damageTypes: d.damageTypes.includes(type)
        ? d.damageTypes.filter((t) => t !== type)
        : [...d.damageTypes, type],
    }));

  const toggleSeverity = (severity: Severity) =>
    setDraft((d) => ({
      ...d,
      severities: d.severities.includes(severity)
        ? d.severities.filter((s) => s !== severity)
        : [...d.severities, severity],
    }));

  return (
    <Sheet onClose={onClose} label="Filter reports">
      <h2 className="text-lg font-bold text-foreground">Filters</h2>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">Damage type</h3>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allDamage}
              onChange={() => setDraft((d) => ({ ...d, damageTypes: [] }))}
              className="h-5 w-5 rounded border-border accent-[var(--accent)]"
            />
            All damage types
          </label>
          {DAMAGE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={draft.damageTypes.includes(type)}
                onChange={() => toggleDamage(type)}
                className="h-5 w-5 rounded border-border accent-[var(--accent)]"
              />
              {DAMAGE_LABELS[type]}
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">Severity</h3>
        <div className="mt-3 flex gap-2">
          {SEVERITIES.map((severity) => {
            const active = draft.severities.includes(severity);
            return (
              <button
                key={severity}
                onClick={() => toggleSeverity(severity)}
                aria-pressed={active}
                className={`tap-target flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {SEVERITY_LABELS[severity]}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-sm font-semibold text-foreground">Date range</h3>
        <div className="mt-3 flex gap-2">
          {RANGES.map((range) => {
            const active = draft.withinHours === range.hours;
            return (
              <button
                key={range.label}
                onClick={() => setDraft((d) => ({ ...d, withinHours: range.hours }))}
                aria-pressed={active}
                className={`tap-target flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => setDraft(DEFAULT_FILTERS)}
          className="tap-target flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
        >
          Reset
        </button>
        <button
          onClick={() => onApply(draft)}
          className="tap-target flex-[2] rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
        >
          Apply Filters
        </button>
      </div>
    </Sheet>
  );
}

export function Sheet({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="fixed inset-0 z-[1000]">
      <button
        aria-label="Close sheet"
        onClick={onClose}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-label={label}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
        className="glass absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl px-5 pb-8 pt-3"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted" />
        <button
          onClick={onClose}
          aria-label="Close"
          className="tap-target absolute right-3 top-3 flex items-center justify-center rounded-full text-muted-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}
