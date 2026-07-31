import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Your Profile — RoadPulse" },
      {
        name: "description",
        content: "Your RoadPulse contribution stats, badges and account settings.",
      },
      { property: "og:title", content: "Your Profile — RoadPulse" },
      { property: "og:description", content: "Track your reports, points and rank." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, user, role, signOut } = useAuth();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center gap-4 bg-background px-6 pb-28 pt-16 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/12 text-accent">
        <UserRound className="h-10 w-10" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold text-foreground">
        {profile?.full_name ?? user?.email ?? "Your profile"}
      </h1>
      <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
        {role}
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">
        Stats, badges and settings arrive in Phase 12.
      </p>
      <button
        onClick={async () => {
          await signOut();
          toast.success("Signed out");
          void navigate({ to: "/login", replace: true });
        }}
        className="tap-target mt-4 flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-critical"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign Out
      </button>
      <BottomNav />
    </main>
  );
}
