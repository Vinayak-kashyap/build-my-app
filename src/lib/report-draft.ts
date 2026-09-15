import type { DamageType, Severity } from "@/lib/roadpulse";

export type ReportDraft = {
  photos: string[]; // data URLs
  damage_types: DamageType[];
  severity: Severity;
  bike_severity: Severity;
  car_severity: Severity;
  confidence: number;
  ai_summary: string;
  ai_suggestion: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  notes: string;
  tags: string[];
};

const KEY = "roadpulse.report-draft";

export const emptyDraft: ReportDraft = {
  photos: [],
  damage_types: [],
  severity: "moderate",
  bike_severity: "moderate",
  car_severity: "moderate",
  confidence: 0,
  ai_summary: "",
  ai_suggestion: "",
  latitude: null,
  longitude: null,
  address: null,
  notes: "",
  tags: [],
};

export function saveDraft(draft: ReportDraft) {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function loadDraft(): ReportDraft | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return { ...emptyDraft, ...(JSON.parse(raw) as ReportDraft) };
  } catch {
    return null;
  }
}

export function clearDraft() {
  sessionStorage.removeItem(KEY);
}

/** Downscale + compress a captured image so drafts and uploads stay small. */
export function compressImage(source: Blob | HTMLVideoElement, maxSize = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const draw = (
      width: number,
      height: number,
      paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
    ) => {
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      paint(ctx, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };

    if (source instanceof HTMLVideoElement) {
      draw(source.videoWidth, source.videoHeight, (ctx, w, h) =>
        ctx.drawImage(source, 0, 0, w, h),
      );
      return;
    }

    const img = new Image();
    img.onload = () => draw(img.width, img.height, (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h));
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = URL.createObjectURL(source);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
