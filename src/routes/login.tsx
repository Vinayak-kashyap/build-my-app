import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — RoadPulse" },
      { name: "description", content: "Sign in to RoadPulse to report road damage and navigate safely." },
      { property: "og:title", content: "Sign In — RoadPulse" },
      { property: "og:description", content: "Access your RoadPulse account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/map", replace: true });
  }, [session, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      toast.error("Sign in failed", { description: signInError.message });
      return;
    }
    toast.success("Welcome back");
    void navigate({ to: "/map", replace: true });
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/map", replace: true });
  }

  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to keep your roads on the map.">
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

        <div>
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              type={show ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow((s) => !s)}
              className="tap-target absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center text-muted-foreground"
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-accent">
            Forgot Password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          Sign In
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={onGoogle}
        className="tap-target flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface px-5 py-3.5 text-sm font-semibold text-foreground"
      >
        <GoogleIcon className="h-5 w-5" />
        Sign in with Google
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/register" className="font-semibold text-accent">
          Register
        </Link>
      </p>
    </AuthShell>
  );
}
