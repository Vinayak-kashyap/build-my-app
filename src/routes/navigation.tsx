import { createFileRoute } from "@tanstack/react-router";
import { Navigation } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  avoid: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const Route = createFileRoute("/navigation")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Damage-Aware Navigation — RoadPulse" },
      {
        name: "description",
        content: "Turn-by-turn routing that avoids damaged and flooded roads.",
      },
      { property: "og:title", content: "Damage-Aware Navigation — RoadPulse" },
      { property: "og:description", content: "Routes scored by road health, hazards avoided." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NavigationScreen,
});

function NavigationScreen() {
  const { avoid } = Route.useSearch();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <Navigation className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-foreground">Damage-Aware Navigation</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Route options, health scores and turn-by-turn guidance arrive in Phase 5.
      </p>
      {avoid ? (
        <p className="data-mono text-xs text-muted-foreground">avoiding report {avoid}</p>
      ) : null}
    </main>
  );
}
