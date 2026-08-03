/**
 * Bridge for PWA share / pending image → Capture page.
 * Share handoff posts STIPPO_PENDING_CLIP; we also accept IndexedDB.
 */

export type PendingClip = {
  dataUrl: string;
  sourceUrl?: string;
  sourceTitle?: string;
  note?: string;
  /** When true, open the crop editor after ingest (e.g. full screenshot from Share). */
  openCrop?: boolean;
  /** Capture source hint: extension | share | screenshot */
  source?: "extension" | "share" | "screenshot";
  clipRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  };
};

const DB_NAME = "stippo-clip";
const STORE = "pending";
const KEY = "clip";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function writePendingClip(clip: PendingClip): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(clip, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
  });
  db.close();
}

export async function takePendingClip(): Promise<PendingClip | null> {
  const db = await openDb();
  const clip = await new Promise<PendingClip | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(KEY);
    getReq.onsuccess = () => {
      const value = (getReq.result as PendingClip | undefined) ?? null;
      if (value) store.delete(KEY);
      resolve(value);
    };
    getReq.onerror = () => reject(getReq.error ?? new Error("IndexedDB read failed"));
  });
  db.close();
  return clip;
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  if (!header || data == null) {
    throw new Error("Invalid image data URL");
  }
  const mimeMatch = /data:([^;]+);base64/.exec(header);
  const mime = mimeMatch?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export const CLIP_MESSAGE_TYPE = "STIPPO_PENDING_CLIP";
