import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CIVIC_PORTAL_LABELS, CIVIC_STATUS_LABELS, type CivicPortal } from "@/lib/civic";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Console — RoadPulse" },
      { name: "description", content: "Approve authority accounts and manage civic complaint filing." },
      { property: "og:title", content: "Admin Console — RoadPulse" },
      { property: "og:description", content: "Manage RoadPulse authority access and civic complaints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminScreen,
});

type Req = { id: string; user_id: string; organization: string | null; jurisdiction: string | null; created_at: string };
type Sub = {
  id: string;
  report_id: string;
  portal: CivicPortal;
  status: keyof typeof CIVIC_STATUS_LABELS;
  complaint_number: string | null;
  request_payload: Record<string, unknown>;
};

function AdminScreen() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [tab, setTab] = useState<"requests" | "civic">("civic");
  const [reqs, setReqs] = useState<Req[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const isAdmin = role === "admin";
  const allowed = role === "admin" || role === "authority";

  const load = useCallback(async () => {
    if (isAdmin) {
      const { data } = await supabase
        .from("authority_requests")
        .select("id, user_id, organization, jurisdiction, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      setReqs((data as Req[]) ?? []);
    }
    const { data: s } = await supabase
      .from("civic_submissions")
      .select("id, report_id, portal, status, complaint_number, request_payload")
      .in("status", ["manual_required", "failed", "queued"])
      .order("created_at", { ascending: false })
      .limit(100);
    setSubs((s as Sub[]) ?? []);
  }, [isAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!user || !allowed) {
      navigate({ to: "/map" });
      return;
    }
    void load();
  }, [loading, user, allowed, navigate, load]);

  async function decide(r: Req, approve: boolean) {
    const { error } = await supabase
      .from("authority_requests")
      .update({ status: approve ? "approved" : "rejected", reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", r.id);
    if (!error && approve) await supabase.from("user_roles").insert({ user_id: r.user_id, role: "authority" });
    if (error) toast.error(error.message);
    else toast.success(approve ? "Authority access granted" : "Request rejected");
    void load();
  }

  async function copy(s: Sub) {
    const p = s.request_payload ?? {};
    const text = Object.entries(p).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v ?? ""}`).join("\n");
    await navigator.clipboard.writeText(text || `Report ${s.report_id}`);
    toast.success("Complaint details copied");
  }

  async function saveNumber(s: Sub) {
    const num = numbers[s.id]?.trim();
    if (!num) return;
    const { error } = await supabase
      .from("civic_submissions")
      .update({ status: "submitted", complaint_number: num, submitted_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else toast.success("Complaint number saved");
    void load();
  }

  if (!allowed) return null;

  return (
    <main className="min-h-[100dvh] bg-background pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-background/90 px-4 py-3 backdrop-blur">
        <button onClick={() => router.history.back()} aria-label="Go back" className="tap-target rounded-xl border border-border p-2 text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold text-foreground">Admin Console</h1>
      </header>
      <div className="flex gap-2 px-4">
        {(isAdmin ? (["civic", "requests"] as const) : (["civic"] as const)).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`tap-target flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${tab === t ? "bg-accent text-accent-foreground" : "bg-surface text-foreground"}`}>
            {t === "civic" ? `Civic complaints (${subs.length})` : `Authority requests (${reqs.length})`}
          </button>
        ))}
      </div>

      <section className="space-y-3 px-4 pt-4">
        {tab === "requests" ? (
          reqs.length ? reqs.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">{r.organization ?? "Unnamed organisation"}</p>
              <p className="text-xs text-muted-foreground">{r.jurisdiction ?? "—"} · {new Date(r.created_at).toLocaleDateString()}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => void decide(r, true)} className="tap-target flex flex-1 items-center justify-center gap-1 rounded-xl bg-safe/15 py-2 text-sm font-semibold text-safe"><Check className="h-4 w-4" />Approve</button>
                <button onClick={() => void decide(r, false)} className="tap-target flex flex-1 items-center justify-center gap-1 rounded-xl bg-critical/15 py-2 text-sm font-semibold text-critical"><X className="h-4 w-4" />Reject</button>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : subs.length ? subs.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{CIVIC_PORTAL_LABELS[s.portal] ?? s.portal}</p>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{CIVIC_STATUS_LABELS[s.status] ?? s.status}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{String(s.request_payload?.address ?? "")}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => void copy(s)} className="tap-target flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground"><Copy className="h-3.5 w-3.5" />Copy details</button>
              <button onClick={() => navigate({ to: "/report/$id", params: { id: s.report_id } })} className="tap-target rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground">Open report</button>
            </div>
            <div className="mt-2 flex gap-2">
              <input value={numbers[s.id] ?? ""} onChange={(e) => setNumbers((n) => ({ ...n, [s.id]: e.target.value }))}
                placeholder="Complaint number from portal" className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" />
              <button onClick={() => void saveNumber(s)} className="tap-target rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">Save</button>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No complaints waiting for manual filing.</p>}
      </section>
    </main>
  );
}
