import type {
  SyncQueueItem,
  VaultMemory,
  VaultMeta,
  VaultProject,
} from "@/lib/vault/types";
import { VAULT_SCHEMA_VERSION } from "@/lib/vault/types";
import { newId } from "@/lib/vault/hash";

const DB_NAME = "stippo-vault";
const DB_VERSION = 1;

type StoreName =
  | "meta"
  | "memories"
  | "projects"
  | "blobs"
  | "syncQueue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("memories")) {
        const s = db.createObjectStore("memories", { keyPath: "id" });
        s.createIndex("createdAt", "createdAt");
        s.createIndex("projectId", "projectId");
        s.createIndex("syncState", "syncState");
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains("projects")) {
        const s = db.createObjectStore("projects", { keyPath: "id" });
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains("blobs")) {
        db.createObjectStore("blobs", { keyPath: "relativePath" });
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        const s = db.createObjectStore("syncQueue", { keyPath: "id" });
        s.createIndex("nextAttemptAt", "nextAttemptAt");
        s.createIndex("memoryId", "memoryId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("vault IndexedDB open failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("vault tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("vault tx aborted"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("vault request failed"));
  });
}

export async function getMeta(): Promise<VaultMeta> {
  const db = await openDb();
  try {
    const existing = await reqToPromise(
      db.transaction("meta", "readonly").objectStore("meta").get("current")
    );
    if (existing) return existing as VaultMeta;
    const fresh: VaultMeta = {
      schemaVersion: VAULT_SCHEMA_VERSION,
      deviceId: newId(),
      cloudProvider: "none",
      cloudFolderId: null,
      cloudFolderName: null,
      cloudFolderPath: null,
      lastSyncAt: null,
      userId: null,
    };
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(fresh, "current");
    await txDone(tx);
    return fresh;
  } finally {
    db.close();
  }
}

export async function setMeta(patch: Partial<VaultMeta>): Promise<VaultMeta> {
  const current = await getMeta();
  const next = { ...current, ...patch };
  const db = await openDb();
  try {
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(next, "current");
    await txDone(tx);
    return next;
  } finally {
    db.close();
  }
}

export async function putMemory(memory: VaultMemory): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("memories", "readwrite");
    tx.objectStore("memories").put(stripBlobUrls(memory));
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getMemory(id: string): Promise<VaultMemory | null> {
  const db = await openDb();
  try {
    const m = await reqToPromise(
      db.transaction("memories", "readonly").objectStore("memories").get(id)
    );
    return (m as VaultMemory) ?? null;
  } finally {
    db.close();
  }
}

export async function listMemories(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<VaultMemory[]> {
  const db = await openDb();
  try {
    const all = await reqToPromise(
      db.transaction("memories", "readonly").objectStore("memories").getAll()
    );
    let rows = (all as VaultMemory[]) || [];
    if (opts?.projectId) {
      rows = rows.filter((m) => m.projectId === opts.projectId);
    }
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return rows.slice(0, opts?.limit ?? 500);
  } finally {
    db.close();
  }
}

export async function deleteMemoryRecord(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(["memories", "blobs", "syncQueue"], "readwrite");
    tx.objectStore("memories").delete(id);
    const blobs = await reqToPromise(tx.objectStore("blobs").getAll());
    for (const b of blobs as { relativePath: string; memoryId?: string }[]) {
      if (b.relativePath.includes(id) || b.memoryId === id) {
        tx.objectStore("blobs").delete(b.relativePath);
      }
    }
    const queue = await reqToPromise(tx.objectStore("syncQueue").getAll());
    for (const q of queue as SyncQueueItem[]) {
      if (q.memoryId === id) tx.objectStore("syncQueue").delete(q.id);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function putProject(project: VaultProject): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(project);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function listProjects(): Promise<VaultProject[]> {
  const db = await openDb();
  try {
    const all = await reqToPromise(
      db.transaction("projects", "readonly").objectStore("projects").getAll()
    );
    return ((all as VaultProject[]) || []).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } finally {
    db.close();
  }
}

export async function putBlob(
  relativePath: string,
  blob: Blob,
  meta?: { memoryId: string; kind: string }
): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").put({
      relativePath,
      blob,
      mimeType: blob.type,
      memoryId: meta?.memoryId,
      kind: meta?.kind,
      updatedAt: new Date().toISOString(),
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getBlob(relativePath: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    const row = await reqToPromise(
      db.transaction("blobs", "readonly").objectStore("blobs").get(relativePath)
    );
    return row ? ((row as { blob: Blob }).blob ?? null) : null;
  } finally {
    db.close();
  }
}

export async function enqueueSync(item: Omit<SyncQueueItem, "id"> & { id?: string }) {
  const db = await openDb();
  try {
    const full: SyncQueueItem = {
      id: item.id || newId(),
      memoryId: item.memoryId,
      action: item.action,
      attempts: item.attempts,
      nextAttemptAt: item.nextAttemptAt,
      lastError: item.lastError,
      createdAt: item.createdAt,
    };
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").put(full);
    await txDone(tx);
    return full;
  } finally {
    db.close();
  }
}

export async function listSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDb();
  try {
    const all = await reqToPromise(
      db.transaction("syncQueue", "readonly").objectStore("syncQueue").getAll()
    );
    return ((all as SyncQueueItem[]) || []).sort((a, b) =>
      a.nextAttemptAt.localeCompare(b.nextAttemptAt)
    );
  } finally {
    db.close();
  }
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction("syncQueue", "readwrite");
    tx.objectStore("syncQueue").delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function memoryCount(): Promise<number> {
  const db = await openDb();
  try {
    return await reqToPromise(
      db.transaction("memories", "readonly").objectStore("memories").count()
    );
  } finally {
    db.close();
  }
}

function stripBlobUrls(m: VaultMemory): VaultMemory {
  const rest = { ...m };
  delete rest.localBlobUrl;
  delete rest.thumbBlobUrl;
  return rest;
}

/** Ensure stores exist — call on app boot. */
export async function ensureVaultDb(): Promise<void> {
  const db = await openDb();
  db.close();
  await getMeta();
}

export type { StoreName };
