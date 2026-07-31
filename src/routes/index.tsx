import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RoadPulse — Intelligence for Every Road" },
      {
        name: "description",
        content:
          "RoadPulse detects road damage with AI, maps hazards in real time and routes you around them.",
      },
      { property: "og:title", content: "RoadPulse — Intelligence for Every Road" },
      {
        property: "og:description",
        content: "AI road damage detection, live hazard maps and damage-aware navigation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

type InstallPromptEvent = Event & { prompt: () => Promise<void> };

function Splash() {
  const navigate = useNavigate();
  const { loading, session, profile } = useAuth();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem("roadpulse.install-dismissed") === "1") return;
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (session) {
        void navigate({ to: profile?.onboarding_completed ? "/map" : "/onboarding" });
        return;
      }
      const seen = localStorage.getItem("roadpulse.onboarded") === "1";
      void navigate({ to: seen ? "/login" : "/onboarding" });
    }, 1400);
    return () => clearTimeout(timer);
  }, [loading, session, profile, navigate]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] bg-surface shadow-glow ring-1 ring-accent/40"
      >
        <motion.span
          className="absolute inset-0 rounded-[2rem] bg-accent/15"
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
        />
        <Activity className="h-14 w-14 text-accent" aria-hidden="true" />
      </motion.div>

      <motion.h1
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative mt-8 text-4xl font-extrabold text-foreground"
      >
        Road<span className="text-accent">Pulse</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative mt-3 text-sm tracking-wide text-muted-foreground"
      >
        Intelligence for Every Road
      </motion.p>

      {installEvent ? (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass fixed inset-x-4 bottom-6 flex items-center gap-3 rounded-2xl p-4"
        >
          <Download className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="flex-1 text-sm text-foreground">Install RoadPulse for offline reporting</p>
          <button
            onClick={() => {
              void installEvent.prompt();
              setInstallEvent(null);
            }}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
          >
            Install
          </button>
          <button
            aria-label="Dismiss install banner"
            onClick={() => {
              localStorage.setItem("roadpulse.install-dismissed", "1");
              setInstallEvent(null);
            }}
            className="tap-target flex items-center justify-center text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </motion.div>
      ) : null}
    </main>
  );
}
