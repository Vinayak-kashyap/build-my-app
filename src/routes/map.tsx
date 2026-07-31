import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/map")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Live Road Map — RoadPulse" },
      {
        name: "description",
        content: "Explore live road damage reports, hazard severity and community verification.",
      },
      { property: "og:title", content: "Live Road Map — RoadPulse" },
      { property: "og:description", content: "Real-time road hazard map powered by AI and the community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const navigate = useNavigate();
  const { loading, session, profile, role, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) void navigate({ to: "/login", replace: true });
    else if (profile && !profile.onboarding_completed) {
      void supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", session.user.id);
    }
  }, [loading, session, profile, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <MapPin className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-foreground">Live Road Map</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Signed in as{" "}
        <span className="font-semibold text-foreground">
          {profile?.full_name ?? session?.user.email ?? "…"}
        </span>{" "}
        · <span className="font-mono uppercase text-accent">{role}</span>
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        The interactive hazard map arrives in Phase 3.
      </p>
      <button
        onClick={async () => {
          await signOut();
          toast.success("Signed out");
          void navigate({ to: "/login", replace: true });
        }}
        className="tap-target rounded-xl border border-border px-5 py-3 text-sm font-semibold text-critical"
      >
        Sign Out
      </button>
    </main>
  );
}
