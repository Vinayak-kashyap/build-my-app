import { openDB, type IDBPDatabase } from "idb";
import { supabase } from "@/integrations/supabase/client";
import { dataUrlToBlob, type ReportDraft } from "@/lib/report-draft";

const DB_NAME = "roadpulse";
const STORE = "pending-reports";

export type PendingReport = ReportDraft & { id: string; queuedAt: string };

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function queueReport(draft: ReportDraft) {
  const entry: PendingReport = {
    ...draft,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
  await (await db()).put(STORE, entry);
  return entry;
}

export async function listPending(): Promise<PendingReport[]> {
  return (await (await db()).getAll(STORE)) as PendingReport[];
}

export async function removePending(id: string) {
  await (await db()).delete(STORE, id);
}

/** Upload photos + insert one report row. Shared by online submit and offline sync. */
export async function uploadReport(draft: ReportDraft, userId: string) {
  if (draft.latitude == null || draft.longitude == null) {
    throw new Error("Location missing — please retry with location services on");
  }
  const paths: string[] = [];
  for (const [index, dataUrl] of draft.photos.entries()) {
    const blob = dataUrlToBlob(dataUrl);
    const path = `${userId}/${Date.now()}-${index}.jpg`;
    const { error } = await supabase.storage
      .from("report-photos")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw error;
    paths.push(path);
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: userId,
      latitude: draft.latitude,
      longitude: draft.longitude,
      address: draft.address,
      district: DEFAULT_DISTRICT,
      damage_types: draft.damage_types,
      severity: draft.severity,
      bike_severity:
        draft.bike_severity ?? deriveVehicleSeverity("bike", draft.severity, draft.damage_types),
      car_severity:
        draft.car_severity ?? deriveVehicleSeverity("car", draft.severity, draft.damage_types),
      confidence: draft.confidence,
      ai_summary: draft.ai_summary || null,
      ai_suggestion: draft.ai_suggestion || null,
      notes: draft.notes || null,
      tags: draft.tags,
      photos: paths,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Background: file the complaint on the Lucknow civic portals.
  try {
    await fileCivicComplaints({ data: { reportId: data.id } });
  } catch {
    // The rows stay queued in civic_submissions and are retried later.
  }

  return data.id as string;
}

export async function syncPending(userId: string) {
  const pending = await listPending();
  let synced = 0;
  for (const entry of pending) {
    try {
      await uploadReport(entry, userId);
      await removePending(entry.id);
      synced++;
    } catch {
      break;
    }
  }
  return synced;
}
