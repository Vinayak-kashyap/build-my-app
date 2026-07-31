import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/alerts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alerts — RoadPulse" },
      {
        name: "description",
        content: "Hazard proximity, authority and repair status alerts from RoadPulse.",
      },
      { property: "og:title", content: "Alerts — RoadPulse" },
      { property: "og:description", content: "Stay ahead of hazards and repair updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsScreen,
});

function AlertsScreen() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 pb-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <Bell className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        No alerts yet — keep contributing to the community!
      </p>
      <BottomNav />
    </main>
  );
}
