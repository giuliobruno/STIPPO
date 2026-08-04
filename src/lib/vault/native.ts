import type { VaultSyncAdapter } from "@/lib/vault/types";

/**
 * Capacitor filesystem helpers for native vault root.
 * Web falls back to IndexedDB blobs (idb.ts).
 */
export async function isNativeVault(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function writeNativeFile(
  relativePath: string,
  data: Blob
): Promise<void> {
  const { Filesystem, Directory, Encoding } = await import(
    "@capacitor/filesystem"
  );
  const base64 = await blobToBase64(data);
  const parts = relativePath.split("/");
  const fileName = parts.pop()!;
  const dir = ["Stippo", ...parts].join("/");
  await Filesystem.mkdir({
    path: dir,
    directory: Directory.Documents,
    recursive: true,
  }).catch(() => {});
  await Filesystem.writeFile({
    path: `${dir}/${fileName}`,
    data: base64,
    directory: Directory.Documents,
  });
  void Encoding;
}

export async function readNativeFile(
  relativePath: string
): Promise<Blob | null> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const path = `Stippo/${relativePath}`;
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Documents,
    });
    const data = result.data;
    if (typeof data === "string") {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes]);
    }
    return null;
  } catch {
    return null;
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Optional: expose adapter factory for native-only paths later. */
export function createCapacitorBridge(): Pick<VaultSyncAdapter, "id" | "label"> {
  return { id: "local_folder", label: "Device Documents/Stippo" };
}
