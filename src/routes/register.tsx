import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create Account — RoadPulse" },
      {
        name: "description",
        content: "Create a RoadPulse account as a citizen reporter or a municipal authority.",
      },
      { property: "og:title", content: "Create Account — RoadPulse" },
      { property: "og:description", content: "Join RoadPulse and help map road health." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Register,
});

function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ["Too short", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["bg-muted", "bg-critical", "bg-moderate", "bg-water", "bg-safe"];

const inputClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring";

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [role, setRole] = useState<"citizen" | "authority">("citizen");
  const [organization, setOrganization] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [credential, setCredential] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const score = passwordScore(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (score < 2) {
      setError("Choose a stronger password (8+ characters with a number or symbol).");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms of Service.");
      return;
    }
    if (role === "authority" && !credential) {
      setError("Upload a credential document to request authority access.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      toast.error("Registration failed", { description: signUpError.message });
      return;
    }

    if (role === "authority" && data.session && data.user) {
      let credentialPath: string | null = null;
      if (credential) {
        const path = `${data.user.id}/${Date.now()}-${credential.name}`;
        const { error: uploadError } = await supabase.storage
          .from("authority-credentials")
          .upload(path, credential);
        if (!uploadError) credentialPath = path;
      }
      await supabase.from("authority_requests").insert({
        user_id: data.user.id,
        organization,
        jurisdiction,
        credential_path: credentialPath,
      });
    }

    setLoading(false);

    if (!data.session) {
      toast.success("Account created", {
        description: "Check your email to confirm your address, then sign in.",
      });
      void navigate({ to: "/login" });
      return;
    }

    toast.success("Welcome to RoadPulse", {
      description:
        role === "authority"
          ? "Your authority request is pending admin approval."
          : "Your citizen account is ready.",
    });
    void navigate({ to: "/onboarding" });
  }

  async function onGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-up failed");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/onboarding" });
  }

  return (
    <AuthShell title="Create Account" subtitle="Join the community mapping road health.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="text-sm font-medium text-foreground">
            Full Name
          </label>
          <input
            id="fullName"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Alex Mehta"
          />
        </div>

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
            className={inputClass}
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
              autoComplete="new-password"
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
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${strengthColors[score]}`}
                style={{ width: `${(score / 4) * 100}%` }}
              />
            </div>
            <span className="w-20 text-right text-xs text-muted-foreground">
              {strengthLabels[score]}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <input
            id="confirm"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </div>

        <div>
          <span className="text-sm font-medium text-foreground">Account type</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-1">
            {(["citizen", "authority"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`tap-target rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                  role === r
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {role === "authority" ? (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">
              Authority access is granted after an admin reviews your credentials.
            </p>
            <div>
              <label htmlFor="organization" className="text-sm font-medium text-foreground">
                Organization
              </label>
              <input
                id="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className={inputClass}
                placeholder="City Public Works Dept."
              />
            </div>
            <div>
              <label htmlFor="jurisdiction" className="text-sm font-medium text-foreground">
                Jurisdiction
              </label>
              <input
                id="jurisdiction"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className={inputClass}
                placeholder="Bengaluru South Zone"
              />
            </div>
            <div>
              <label
                htmlFor="credential"
                className="tap-target mt-1.5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
              >
                <Upload className="h-5 w-5 text-accent" aria-hidden="true" />
                {credential ? credential.name : "Upload credential document"}
              </label>
              <input
                id="credential"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setCredential(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        ) : null}

        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-border accent-[var(--accent)]"
          />
          <span>
            I agree to the{" "}
            <a href="/terms" className="font-semibold text-accent">
              Terms of Service
            </a>
          </span>
        </label>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 text-base font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          Create Account
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
        Sign up with Google
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
