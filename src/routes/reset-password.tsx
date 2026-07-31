import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set New Password — RoadPulse" },
      { name: "description", content: "Choose a new password for your RoadPulse account." },
      { property: "og:title", content: "Set New Password — RoadPulse" },
      { property: "og:description", content: "Finish resetting your RoadPulse password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    toast.success("Password updated");
    void navigate({ to: "/map", replace: true });
  }

  return (
    <AuthShell title="Set a New Password" subtitle="Choose a strong password you haven't used before.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            New Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <input
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          Update Password
        </button>
      </form>
    </AuthShell>
  );
}
