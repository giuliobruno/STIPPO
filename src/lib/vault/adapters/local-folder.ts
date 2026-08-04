import type {
  RemoteRef,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";

const HANDLE_KEY = "stippo_local_folder_name";

type DirHandle = FileSystemDirectoryHandle;

/**
 * Desktop adapter: write into a user-picked folder that is already synced
 * by Google Drive Desktop / OneDrive / Dropbox.
 * Uses File System Access API (Chrome/Edge).
 */
export function createLocalFolderAdapter(): VaultSyncAdapter {
  let root: DirHandle | null = null;

  return {
    id: "local_folder",
    label: "Local sync folder",

    async connect(): Promise<VaultLocation> {
      if (!("showDirectoryPicker" in window)) {
        throw new Error(
          "Folder picker requires Chrome or Edge on desktop. Use Google Drive OAuth on mobile."
        );
      }
      root = await (
        window as unknown as {
          showDirectoryPicker: (opts?: { mode?: string }) => Promise<DirHandle>;
        }
      ).showDirectoryPicker({ mode: "readwrite" });
      localStorage.setItem(HANDLE_KEY, root.name);
      // Persist handle in IndexedDB for re-open
      await saveHandle(root);
      return {
        provider: "local_folder",
        folderId: root.name,
        folderName: root.name,
        displayPath: root.name,
      };
    },

    async disconnect(): Promise<void> {
      root = null;
      localStorage.removeItem(HANDLE_KEY);
      await clearHandle();
    },

    async isConnected(): Promise<boolean> {
      if (root) return true;
      root = await loadHandle();
      return Boolean(root);
    },

    async getLocation(): Promise<VaultLocation | null> {
      if (!(await this.isConnected()) || !root) return null;
      return {
        provider: "local_folder",
        folderId: root.name,
        folderName: root.name,
        displayPath: root.name,
      };
    },

    async push(relativePath, data): Promise<RemoteRef> {
      const dir = await ensureRoot();
      const fileHandle = await getFileHandle(dir, relativePath, true);
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return {
        id: relativePath,
        name: relativePath.split("/").pop() || relativePath,
        path: relativePath,
        size: data.size,
      };
    },

    async pull(relativePath): Promise<Blob | null> {
      try {
        const dir = await ensureRoot();
        const fileHandle = await getFileHandle(dir, relativePath, false);
        const file = await fileHandle.getFile();
        return file;
      } catch {
        return null;
      }
    },

    async list(prefix = ""): Promise<RemoteRef[]> {
      const dir = await ensureRoot();
      const target = prefix
        ? await getDirHandle(dir, prefix, false)
        : dir;
      const out: RemoteRef[] = [];
      // @ts-expect-error async iterator
      for await (const [name, handle] of target.entries()) {
        if (handle.kind === "file") {
          out.push({
            id: prefix ? `${prefix}/${name}` : name,
            name,
            path: prefix ? `${prefix}/${name}` : name,
          });
        }
      }
      return out;
    },

    async remove(relativePath): Promise<void> {
      try {
        const dir = await ensureRoot();
        const parts = relativePath.split("/").filter(Boolean);
        const name = parts.pop()!;
        let parent = dir;
        for (const p of parts) {
          parent = await parent.getDirectoryHandle(p);
        }
        await parent.removeEntry(name);
      } catch {
        // ignore missing
      }
    },
  };

  async function ensureRoot(): Promise<DirHandle> {
    if (root) return root;
    root = await loadHandle();
    if (!root) throw new Error("Local folder not connected");
    return root;
  }
}

async function getDirHandle(
  root: DirHandle,
  relativePath: string,
  create: boolean
): Promise<DirHandle> {
  const parts = relativePath.split("/").filter(Boolean);
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create });
  }
  return dir;
}

async function getFileHandle(
  root: DirHandle,
  relativePath: string,
  create: boolean
): Promise<FileSystemFileHandle> {
  const parts = relativePath.split("/").filter(Boolean);
  const name = parts.pop()!;
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create });
  }
  return dir.getFileHandle(name, { create });
}

const IDB_HANDLE = "stippo-fs-handle";

async function saveHandle(handle: DirHandle): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, "root");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadHandle(): Promise<DirHandle | null> {
  try {
    const db = await openHandleDb();
    const handle = await new Promise<DirHandle | null>((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("root");
      req.onsuccess = () => resolve((req.result as DirHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!handle) return null;
    // Request permission again
    const perm = await (
      handle as unknown as {
        queryPermission: (o: { mode: string }) => Promise<string>;
        requestPermission: (o: { mode: string }) => Promise<string>;
      }
    ).queryPermission({ mode: "readwrite" });
    if (perm === "granted") return handle;
    const req = await (
      handle as unknown as {
        requestPermission: (o: { mode: string }) => Promise<string>;
      }
    ).requestPermission({ mode: "readwrite" });
    return req === "granted" ? handle : null;
  } catch {
    return null;
  }
}

async function clearHandle(): Promise<void> {
  const db = await openHandleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete("root");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_HANDLE, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handles")) {
        req.result.createObjectStore("handles");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
