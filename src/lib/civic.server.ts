import type { CivicPortal } from "@/lib/civic";

/**
 * Each Lucknow civic portal is configured through environment variables so the
 * app can be pointed at a real intake endpoint without a code change:
 *   CIVIC_<PORTAL>_ENDPOINT  — HTTP form/JSON intake URL (multipart POST)
 *   CIVIC_<PORTAL>_TOKEN     — optional bearer token / API key
 *   CIVIC_<PORTAL>_TRACK_URL — public status page, `{id}` is replaced
 * When no endpoint is configured the submission is parked as `manual_required`
 * with a fully prefilled payload, so nothing is silently lost.
 */
const ENV_PREFIX: Record<CivicPortal, string> = {
  everything_civic: "CIVIC_EVERYTHING_CIVIC",
  lucknow_smart_city: "CIVIC_LUCKNOW_SMART_CITY",
  lucknow_nagar_nigam: "CIVIC_LUCKNOW_NAGAR_NIGAM",
};

export type CivicPayload = {
  complainant_name: string;
  phone: string | null;
  email: string | null;
  category: string;
  severity: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  district: string;
  reported_at: string;
};

export type CivicResult = {
  status: "submitted" | "failed" | "manual_required";
  complaint_number: string | null;
  tracking_url: string | null;
  error_message: string | null;
  response: unknown;
};

const COMPLAINT_PATTERNS = [
  /"(?:complaint|grievance|ticket|request)[_ ]?(?:no|number|id)"\s*:\s*"?([A-Za-z0-9\-/]{4,})"?/i,
  /(?:complaint|grievance|ticket)\s*(?:no\.?|number|id)\s*[:#-]?\s*([A-Za-z0-9\-/]{4,})/i,
];

export function extractComplaintNumber(body: string): string | null {
  for (const pattern of COMPLAINT_PATTERNS) {
    const match = pattern.exec(body);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function submitToPortal(
  portal: CivicPortal,
  payload: CivicPayload,
  photos: { filename: string; blob: Blob }[],
): Promise<CivicResult> {
  const prefix = ENV_PREFIX[portal];
  const endpoint = process.env[`${prefix}_ENDPOINT`];
  const token = process.env[`${prefix}_TOKEN`];
  const trackTemplate = process.env[`${prefix}_TRACK_URL`];

  if (!endpoint) {
    return {
      status: "manual_required",
      complaint_number: null,
      tracking_url: null,
      error_message:
        "No intake endpoint configured for this portal — the complaint is prepared and waiting to be filed.",
      response: null,
    };
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value !== null && value !== undefined) form.append(key, String(value));
  }
  photos.forEach((photo, index) => {
    form.append(index === 0 ? "attachment" : `attachment_${index + 1}`, photo.blob, photo.filename);
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        status: "failed",
        complaint_number: null,
        tracking_url: null,
        error_message: `Portal responded ${response.status}`,
        response: text.slice(0, 2000),
      };
    }

    const complaintNumber = extractComplaintNumber(text);
    return {
      status: complaintNumber ? "submitted" : "manual_required",
      complaint_number: complaintNumber,
      tracking_url:
        complaintNumber && trackTemplate
          ? trackTemplate.replace("{id}", encodeURIComponent(complaintNumber))
          : null,
      error_message: complaintNumber
        ? null
        : "Portal accepted the form but returned no complaint number.",
      response: text.slice(0, 2000),
    };
  } catch (error) {
    return {
      status: "failed",
      complaint_number: null,
      tracking_url: null,
      error_message: error instanceof Error ? error.message : "Network error",
      response: null,
    };
  }
}
