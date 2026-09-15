export const CIVIC_PORTALS = [
  "everything_civic",
  "lucknow_smart_city",
  "lucknow_nagar_nigam",
] as const;
export type CivicPortal = (typeof CIVIC_PORTALS)[number];

export const CIVIC_SUBMISSION_STATUSES = [
  "queued",
  "submitting",
  "submitted",
  "failed",
  "manual_required",
] as const;
export type CivicSubmissionStatus = (typeof CIVIC_SUBMISSION_STATUSES)[number];

export const CIVIC_PORTAL_LABELS: Record<CivicPortal, string> = {
  everything_civic: "Everything Civic CRM",
  lucknow_smart_city: "Lucknow Smart City",
  lucknow_nagar_nigam: "Lucknow Nagar Nigam",
};

export const CIVIC_STATUS_LABELS: Record<CivicSubmissionStatus, string> = {
  queued: "Queued",
  submitting: "Sending…",
  submitted: "Filed",
  failed: "Failed",
  manual_required: "Needs manual filing",
};

export type CivicSubmission = {
  id: string;
  report_id: string;
  portal: CivicPortal;
  status: CivicSubmissionStatus;
  complaint_number: string | null;
  tracking_url: string | null;
  error_message: string | null;
  attempts: number;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};
