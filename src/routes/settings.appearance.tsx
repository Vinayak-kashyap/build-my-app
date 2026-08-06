import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Moon, Sun, SunMoon } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";
import { THEME_OPTIONS, type ThemePref } from "@/lib/theme";

export const Route = createFileRoute("/settings/appearance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Appearance & Theme — RoadPulse" },
      {
        name: "description",
        content: "Choose a dark, bright or automatic day/night theme for the RoadPulse map and app.",
      },
      { property: "og:title", content: "Appearance & Theme — RoadPulse" },
      { property: "og:description", content: "Dark, bright or auto day/night theme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppearanceSettings,
});

const ICON: Record<ThemePref, typeof Moon> = { dark: Moon, light: Sun, auto: SunMoon };

function AppearanceSettings() {
  const navigate = useNavigate();
  const { theme, resolved, setTheme } = useTheme();

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <button
          aria-label="Back"
          onClick={() => navigate({ to: "/profile" })}
          className="tap-target flex items-center justify-center rounded-full text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Appearance</h1>
      </header>

      <section className="px-4 py-5">
        <label htmlFor="theme-select" className="text-sm font-semibold text-foreground">
          Theme
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Currently showing the <span className="font-semibold text-foreground">{resolved}</span>{" "}
          palette. Map tiles switch with the theme.
        </p>
        <select
          id="theme-select"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value as ThemePref);
            toast.success("Theme updated");
          }}
          className="tap-target mt-3 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground"
        >
          {THEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="mt-4 space-y-2">
          {THEME_OPTIONS.map((o) => {
            const Icon = ICON[o.value];
            const active = theme === o.value;
            return (
              <button
                key={o.value}
                onClick={() => {
                  setTheme(o.value);
                  toast.success(`${o.label} enabled`);
                }}
                aria-pressed={active}
                className={`tap-target flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                  active ? "border-accent bg-accent/10" : "border-border bg-surface"
                }`}
              >
                <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
                <span className="flex-1">
                  <span className="block text-sm font-medium text-foreground">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
