import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ImageIcon, Loader2, X, Zap, ZapOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { detectDamage, type DamageDetection } from "@/lib/ai-detect.functions";
import { compressImage, emptyDraft, loadDraft, saveDraft } from "@/lib/report-draft";
import {
  DAMAGE_LABELS,
  deriveVehicleSeverity,
  SEVERITY_LABELS,
  SEVERITY_TOKEN,
  VEHICLE_LABELS,
  type DamageType,
  type Severity,
} from "@/lib/roadpulse";

export const Route = createFileRoute("/report/capture")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Capture Road Damage — RoadPulse" },
      {
        name: "description",
        content: "Photograph a damaged road and let RoadPulse AI classify the damage and severity.",
      },
      { property: "og:title", content: "Capture Road Damage — RoadPulse" },
      { property: "og:description", content: "AI road damage detection from your camera." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaptureScreen,
});

type Phase = "camera" | "analyzing" | "result" | "error";

function CaptureScreen() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Reporting requires an account — guests are sent to sign in.
  useEffect(() => {
    if (!authLoading && !user) {
      toast.message("Sign in to report road damage");
      void navigate({ to: "/login", replace: true });
    }
  }, [authLoading, user, navigate]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [photo, setPhoto] = useState<string | null>(null);
  const [detection, setDetection] = useState<DamageDetection | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCameraError("Camera unavailable — upload a photo from your gallery instead.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn((t) => !t);
    } catch {
      toast.error("Flash isn't available on this camera");
    }
  }

  async function analyze(dataUrl: string) {
    setPhoto(dataUrl);
    setPhase("analyzing");
    try {
      const result = await detectDamage({ data: { image: dataUrl } });
      setDetection(result);
      setPhase("result");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI analysis failed");
      setPhase("error");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera isn't ready yet");
      return;
    }
    const dataUrl = await compressImage(video);
    void analyze(dataUrl);
  }

  async function onPickFile(file: File) {
    const dataUrl = await compressImage(file);
    void analyze(dataUrl);
  }

  function retake() {
    setPhoto(null);
    setDetection(null);
    setPhase("camera");
  }

  function continueToSubmit(useAi: boolean) {
    if (!photo) return;
    const draft = loadDraft() ?? emptyDraft;
    saveDraft({
      ...draft,
      photos: [photo],
      damage_types: useAi
        ? ((detection?.damage_types ?? []) as DamageType[])
        : (["pothole"] as DamageType[]),
      severity: useAi ? ((detection?.severity ?? "moderate") as Severity) : "moderate",
      bike_severity: useAi
        ? ((detection?.bike_severity ??
            deriveVehicleSeverity(
              "bike",
              (detection?.severity ?? "moderate") as Severity,
              (detection?.damage_types ?? []) as DamageType[],
            )) as Severity)
        : "moderate",
      car_severity: useAi
        ? ((detection?.car_severity ??
            deriveVehicleSeverity(
              "car",
              (detection?.severity ?? "moderate") as Severity,
              (detection?.damage_types ?? []) as DamageType[],
            )) as Severity)
        : "moderate",
      confidence: useAi ? (detection?.confidence ?? 0) : 0,
      ai_summary: useAi ? (detection?.summary ?? "") : "",
      ai_suggestion: useAi ? (detection?.repair_suggestion ?? "") : "",
    });
    void navigate({ to: "/report/submit" });
  }

  const severity = (detection?.severity ?? "moderate") as Severity;

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        aria-label="Camera viewfinder"
      />

      {cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-muted-foreground">
          {cameraError}
        </div>
      ) : null}

      {/* Scanning bracket overlay */}
      {phase === "camera" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="relative h-64 w-64"
          >
            {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map(
              (pos) => (
                <span
                  key={pos}
                  className={`absolute h-10 w-10 rounded-sm border-accent ${pos}`}
                />
              ),
            )}
          </motion.div>
        </div>
      ) : null}

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          onClick={() => navigate({ to: "/map" })}
          aria-label="Close camera"
          className="glass tap-target flex items-center justify-center rounded-full text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          onClick={toggleTorch}
          aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          className="glass tap-target flex items-center justify-center rounded-full text-foreground"
        >
          {torchOn ? <Zap className="h-5 w-5" aria-hidden="true" /> : <ZapOff className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      <div className="glass absolute inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] z-10 rounded-xl px-4 py-2 text-center text-sm text-foreground">
        Point camera at the damaged road surface
      </div>

      {/* Shutter row */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between px-8 pb-[calc(env(safe-area-inset-bottom)+28px)]">
        <button
          onClick={() => fileRef.current?.click()}
          aria-label="Upload photo from gallery"
          className="glass tap-target flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl text-foreground"
        >
          {photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPickFile(file);
          }}
        />
        <button
          onClick={capture}
          aria-label="Capture photo"
          className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-accent bg-accent/20 shadow-glow"
        >
          <span className="h-14 w-14 rounded-full bg-accent" />
        </button>
        <span className="h-14 w-14" />
      </div>

      {/* Detection preview */}
      <AnimatePresence>
        {phase !== "camera" ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="glass absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+120px)] z-20 rounded-2xl p-4"
            role="status"
          >
            <div className="flex gap-3">
              {photo ? (
                <img
                  src={photo}
                  alt="Captured road surface"
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : null}

              <div className="min-w-0 flex-1">
                {phase === "analyzing" ? (
                  <div className="flex h-20 items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                    Analysing road damage…
                  </div>
                ) : null}

                {phase === "error" ? (
                  <div className="text-sm">
                    <p className="font-semibold text-critical">AI analysis failed</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{errorMessage}</p>
                  </div>
                ) : null}

                {phase === "result" && detection ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {detection.damage_types.map((type) => (
                        <span
                          key={type}
                          className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-semibold text-foreground"
                        >
                          {DAMAGE_LABELS[type as DamageType] ?? type}
                        </span>
                      ))}
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold"
                        style={{
                          color: SEVERITY_TOKEN[severity],
                          backgroundColor: `color-mix(in oklab, ${SEVERITY_TOKEN[severity]} 18%, transparent)`,
                        }}
                      >
                        {SEVERITY_LABELS[severity]}
                      </span>
                      <span className="data-mono text-xs text-accent">
                        {detection.confidence}%
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      {detection.repair_suggestion}
                    </p>
                    {!detection.is_road ? (
                      <p className="mt-1 text-xs text-moderate">
                        This may not be a road surface — check the photo.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {phase === "result" ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={retake}
                  className="tap-target flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground"
                >
                  Retake
                </button>
                <button
                  onClick={() => continueToSubmit(true)}
                  className="tap-target flex-[2] rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  Looks Right? Continue
                </button>
              </div>
            ) : null}

            {phase === "error" ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => photo && void analyze(photo)}
                  className="tap-target flex-1 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-muted-foreground"
                >
                  Try Again
                </button>
                <button
                  onClick={() => continueToSubmit(false)}
                  className="tap-target flex-1 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground"
                >
                  Submit Manually
                </button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
