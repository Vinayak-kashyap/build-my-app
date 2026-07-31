import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — RoadPulse" },
      { name: "description", content: "Request a password reset link for your RoadPulse account." },
      { property: "og:title", content: "Reset Password — RoadPulse" },
      { property: "og:description", content: "Recover access to your RoadPulse account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Could not send reset link", { description: error.message });
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title={sent ? "Check Your Email" : "Forgot Password"}
      subtitle={
        sent
          ? `We sent a password reset link to ${email}.`
          : "Enter your email and we'll send you a link to reset your password."
      }
    >
      {sent ? (
        <div className="flex flex-col items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-safe/12 text-safe">
            <MailCheck className="h-10 w-10" aria-hidden="true" />
          </span>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Didn't get it? Check spam, or try again in a minute.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            Send Reset Link
          </button>
        </form>
      )}

      <Link
        to="/login"
        className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Login
      </Link>
    </AuthShell>
  );
}
