import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

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

function CommunityScreen() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 pb-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <Trophy className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-foreground">Community</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Leaderboards, badges and streaks arrive in Phase 10.
      </p>
      <BottomNav />
    </main>
  );
}
