import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  Camera,
  Droplets,
  Map as MapIcon,
  Navigation,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadPulse — Intelligence for Every Road" },
      {
        name: "description",
        content:
          "RoadPulse detects road damage with AI, maps hazards in real time and routes you around them. Built for drivers, authorities and city planners.",
      },
      { property: "og:title", content: "RoadPulse — Intelligence for Every Road" },
      {
        property: "og:description",
        content:
          "AI road damage detection, live hazard maps, damage-aware navigation and predictive maintenance in one PWA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

const severities = [
  { label: "Safe", cls: "bg-safe text-safe-foreground", Icon: Activity },
  { label: "Moderate", cls: "bg-moderate text-moderate-foreground", Icon: TriangleAlert },
  { label: "Critical", cls: "bg-critical text-critical-foreground", Icon: ShieldAlert },
  { label: "Waterlogging", cls: "bg-water text-water-foreground", Icon: Droplets },
];

const pillars = [
  { Icon: Camera, title: "Detect", body: "Capture a road and GPT-4o Vision classifies damage and severity instantly." },
  { Icon: MapIcon, title: "Visualize", body: "A live crowd-verified map of road health, updated in real time." },
  { Icon: Navigation, title: "Navigate", body: "Damage-aware routing that steers you around hazards." },
  { Icon: Sparkles, title: "Predict", body: "Weather-correlated forecasts flag roads before they fail." },
];

function Splash() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-secondary/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-6 py-14">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-surface shadow-glow ring-1 ring-accent/40"
        >
          <span className="absolute inset-0 animate-ping rounded-3xl bg-accent/10" />
          <Activity className="h-11 w-11 text-accent" aria-hidden="true" />
        </motion.div>

        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.45 }}
          className="mt-8 text-center text-4xl font-extrabold text-foreground"
        >
          Road<span className="text-accent">Pulse</span>
        </motion.h1>
        <motion.p
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="mt-3 text-center text-base text-muted-foreground"
        >
          Intelligence for Every Road
        </motion.p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {severities.map(({ label, cls, Icon }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${cls}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 grid w-full gap-3">
          {pillars.map(({ Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.4 }}
              className="glass flex items-start gap-3 rounded-2xl p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 w-full rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Live GPS sample
          </p>
          <p className="data-mono mt-1 text-sm text-accent">12.9716° N, 77.5946° E · conf 0.94</p>
        </div>

        <div className="mt-auto w-full pt-10">
          <Link
            to="/"
            className="tap-target flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            Get Started
          </Link>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Foundation ready — auth, map and capture arrive in the next phases.
          </p>
        </div>
      </div>
    </main>
  );
}
