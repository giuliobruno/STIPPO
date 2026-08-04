import type {
  CloudProviderId,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";
import { createGoogleDriveAdapter } from "@/lib/vault/adapters/google-drive";
import { createLocalFolderAdapter } from "@/lib/vault/adapters/local-folder";
import { createOneDriveAdapter } from "@/lib/vault/adapters/onedrive";
import {
  getBlob,
  getMemory,
  getMeta,
  listSyncQueue,
  putBlob,
  putMemory,
  removeSyncItem,
  setMeta,
} from "@/lib/vault/idb";
import { setMemorySyncState } from "@/lib/vault/index";

let activeAdapter: VaultSyncAdapter | null = null;

export function getSyncAdapter(provider: CloudProviderId): VaultSyncAdapter | null {
  switch (provider) {
    case "google_drive":
      return createGoogleDriveAdapter();
    case "local_folder":
      return createLocalFolderAdapter();
    case "onedrive":
      return createOneDriveAdapter();
    default:
      return null;
  }
}

export async function connectCloud(
  provider: CloudProviderId
): Promise<VaultLocation> {
  const adapter = getSyncAdapter(provider);
  if (!adapter) throw new Error("Unknown cloud provider");
  const location = await adapter.connect();
  activeAdapter = adapter;
  await setMeta({
    cloudProvider: provider,
    cloudFolderId: location.folderId,
    cloudFolderName: location.folderName,
    lastSyncAt: null,
  });
  return location;
}

export async function disconnectCloud(): Promise<void> {
  const meta = await getMeta();
  const adapter = activeAdapter || getSyncAdapter(meta.cloudProvider);
  if (adapter) await adapter.disconnect();
  activeAdapter = null;
  await setMeta({
    cloudProvider: "none",
    cloudFolderId: null,
    cloudFolderName: null,
  });
}

export async function getActiveAdapter(): Promise<VaultSyncAdapter | null> {
  if (activeAdapter && (await activeAdapter.isConnected())) return activeAdapter;
  const meta = await getMeta();
  if (meta.cloudProvider === "none") return null;
  const adapter = getSyncAdapter(meta.cloudProvider);
  if (!adapter) return null;
  if (await adapter.isConnected()) {
    activeAdapter = adapter;
    return adapter;
  }
  return null;
}

/**
 * Process sync queue — push local media + vault snapshot to user cloud.
 * Safe to call periodically or after capture.
 */
export async function processSyncQueue(): Promise<{
  processed: number;
  errors: string[];
}> {
  const adapter = await getActiveAdapter();
  if (!adapter) return { processed: 0, errors: ["No cloud connected"] };

  const online = await isOnline();
  if (!online) return { processed: 0, errors: ["Offline — will retry"] };

  const queue = await listSyncQueue();
  const now = Date.now();
  let processed = 0;
  const errors: string[] = [];

  for (const item of queue) {
    if (new Date(item.nextAttemptAt).getTime() > now) continue;

    try {
      if (item.action === "push") {
        await pushMemory(adapter, item.memoryId);
      } else if (item.action === "delete") {
        // Best-effort remote delete
        if (adapter.remove) {
          await adapter.remove(`media/${item.memoryId}`).catch(() => {});
          await adapter.remove(`thumbs/${item.memoryId}.jpg`).catch(() => {});
        }
      }
      await removeSyncItem(item.id);
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      errors.push(`${item.memoryId}: ${message}`);
      const attempts = item.attempts + 1;
      const delayMs = Math.min(60_000, 2000 * 2 ** Math.min(attempts, 5));
      const { enqueueSync } = await import("@/lib/vault/idb");
      await removeSyncItem(item.id);
      await enqueueSync({
        ...item,
        attempts,
        nextAttemptAt: new Date(Date.now() + delayMs).toISOString(),
        lastError: message,
      });
      await setMemorySyncState(item.memoryId, "queued");
    }
  }

  // Push a lightweight vault export (JSON index) for cross-device bootstrap
  try {
    const { listMemories, listProjects } = await import("@/lib/vault/idb");
    const memories = await listMemories({ limit: 5000 });
    const projects = await listProjects();
    const snapshot = JSON.stringify(
      {
        format: "stippo-vault-index-v1",
        exportedAt: new Date().toISOString(),
        projects,
        memories,
      },
      null,
      2
    );
    await adapter.push(
      "vault-index.json",
      new Blob([snapshot], { type: "application/json" }),
      "application/json"
    );
    await setMeta({ lastSyncAt: new Date().toISOString() });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Index push failed");
  }

  return { processed, errors };
}

async function pushMemory(adapter: VaultSyncAdapter, memoryId: string) {
  const memory = await getMemory(memoryId);
  if (!memory) return;

  if (memory.localPath) {
    const blob = await getBlob(memory.localPath);
    if (blob) {
      const ref = await adapter.push(
        memory.localPath,
        blob,
        memory.mimeType || blob.type || "application/octet-stream"
      );
      await setMemorySyncState(memoryId, "synced", { cloudPath: ref.path });
    }
  }
  if (memory.thumbPath) {
    const thumb = await getBlob(memory.thumbPath);
    if (thumb) {
      const ref = await adapter.push(memory.thumbPath, thumb, "image/jpeg");
      await setMemorySyncState(memoryId, "synced", {
        cloudThumbPath: ref.path,
      });
    }
  }

  // Per-memory metadata sidecar
  const m = await getMemory(memoryId);
  if (m) {
    await adapter.push(
      `meta/${memoryId}.json`,
      new Blob([JSON.stringify(m)], { type: "application/json" }),
      "application/json"
    );
    await putMemory({ ...m, syncState: "synced" });
  }
}

/**
 * Pull vault-index.json from cloud into local vault (second device bootstrap).
 */
export async function pullVaultIndex(): Promise<{ imported: number }> {
  const adapter = await getActiveAdapter();
  if (!adapter) throw new Error("No cloud connected");

  const blob = await adapter.pull("vault-index.json");
  if (!blob) return { imported: 0 };

  const text = await blob.text();
  const data = JSON.parse(text) as {
    memories?: Awaited<ReturnType<typeof getMemory>>[];
    projects?: { id: string; name: string }[];
  };

  let imported = 0;
  if (data.projects) {
    const { putProject } = await import("@/lib/vault/idb");
    for (const p of data.projects as import("@/lib/vault/types").VaultProject[]) {
      await putProject(p);
    }
  }
  if (data.memories) {
    for (const m of data.memories as import("@/lib/vault/types").VaultMemory[]) {
      if (!m?.id) continue;
      const existing = await getMemory(m.id);
      if (existing && existing.updatedAt >= m.updatedAt) continue;
      await putMemory({ ...m, syncState: "synced", localPath: m.localPath });
      // Pull media on demand if missing locally
      if (m.localPath) {
        const local = await getBlob(m.localPath);
        if (!local) {
          const remote = await adapter.pull(m.localPath);
          if (remote) await putBlob(m.localPath, remote, { memoryId: m.id, kind: "media" });
        }
      }
      if (m.thumbPath) {
        const local = await getBlob(m.thumbPath);
        if (!local) {
          const remote = await adapter.pull(m.thumbPath);
          if (remote) await putBlob(m.thumbPath, remote, { memoryId: m.id, kind: "thumb" });
        }
      }
      imported += 1;
    }
  }

  await setMeta({ lastSyncAt: new Date().toISOString() });
  return { imported };
}

async function isOnline(): Promise<boolean> {
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return navigator.onLine;
  }
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      return status.connected;
    }
  } catch {
    // network plugin optional
  }
  return true;
}
