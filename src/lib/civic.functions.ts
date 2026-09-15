import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const reportInput = z.object({ reportId: z.string().uuid() });

/**
 * Files every queued civic complaint for one report: builds the payload from
 * the stored report + reporter profile, attaches the photos, records the
 * complaint number, and logs each attempt.
 */
export const fileCivicComplaints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { submitToPortal } = await import("@/lib/civic.server");
    const { CIVIC_PORTAL_LABELS, type CivicPortal } = await import("@/lib/civic");

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (reportError) throw new Error(reportError.message);
    if (!report) throw new Error("Report not found");
    if (report.user_id !== userId) throw new Error("Not your report");

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", userId)
      .maybeSingle();

    const { data: pending } = await supabase
      .from("civic_submissions")
      .select("id, portal, attempts")
      .eq("report_id", data.reportId)
      .in("status", ["queued", "failed"]);

    if (!pending?.length) return { processed: 0 };

    // Signed URLs → bytes, so the portal receives the real photo file.
    const photos: { filename: string; blob: Blob }[] = [];
    for (const [index, path] of (report.photos ?? []).slice(0, 2).entries()) {
      const { data: signed } = await supabase.storage
        .from("report-photos")
        .createSignedUrl(path, 600);
      if (!signed?.signedUrl) continue;
      const res = await fetch(signed.signedUrl);
      if (!res.ok) continue;
      photos.push({ filename: `road-damage-${index + 1}.jpg`, blob: await res.blob() });
    }

    const payload = {
      complainant_name: profile?.full_name ?? "RoadPulse citizen",
      phone: profile?.phone ?? null,
      email: null,
      category: (report.damage_types ?? []).join(", ") || "road damage",
      severity: report.severity as string,
      description:
        [report.ai_summary, report.notes, report.ai_suggestion].filter(Boolean).join(" — ") ||
        "Road damage reported via RoadPulse.",
      address: report.address ?? `${report.latitude}, ${report.longitude}`,
      latitude: report.latitude as number,
      longitude: report.longitude as number,
      district: (report.district as string | null) ?? "Lucknow",
      reported_at: report.created_at as string,
    };

    let processed = 0;
    for (const row of pending) {
      const portal = row.portal as CivicPortal;
      await supabase.from("civic_submissions").update({ status: "submitting" }).eq("id", row.id);

      const result = await submitToPortal(portal, payload, photos);

      await supabase
        .from("civic_submissions")
        .update({
          status: result.status,
          complaint_number: result.complaint_number,
          tracking_url: result.tracking_url,
          error_message: result.error_message,
          attempts: (row.attempts ?? 0) + 1,
          request_payload: payload,
          response_payload: result.response ? { body: result.response } : null,
          submitted_at: result.status === "submitted" ? new Date().toISOString() : null,
        })
        .eq("id", row.id);

      await supabase.from("civic_submission_logs").insert({
        submission_id: row.id,
        status: result.status,
        message:
          result.error_message ??
          `${CIVIC_PORTAL_LABELS[portal]} accepted the complaint${
            result.complaint_number ? ` (#${result.complaint_number})` : ""
          }`,
      });
      processed++;
    }

    return { processed };
  });
