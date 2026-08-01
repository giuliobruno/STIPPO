import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { StoragePutResult } from "@/types";

/**
 * Storage abstraction — local-first by default.
 * Swap implementation via STORAGE_BACKEND without changing callers.
 * Originals stay on disk (or device in a native wrapper); DB stores keys only.
 */
export interface StorageProvider {
  put(
    userId: string,
    data: Buffer,
    opts: { filename: string; mimeType: string; folder?: string }
  ): Promise<StoragePutResult>;
  getPublicUrl(key: string): string;
  delete(key: string): Promise<void>;
  read(key: string): Promise<Buffer>;
}

class LocalStorageProvider implements StorageProvider {
  private root: string;

  constructor() {
    this.root = path.resolve(process.env.LOCAL_STORAGE_PATH || "./storage");
  }

  private resolveKey(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root)) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(
    userId: string,
    data: Buffer,
    opts: { filename: string; mimeType: string; folder?: string }
  ): Promise<StoragePutResult> {
    const ext = path.extname(opts.filename) || mimeToExt(opts.mimeType);
    const folder = opts.folder || "originals";
    const key = path.posix.join(userId, folder, `${randomUUID()}${ext}`);
    const full = this.resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return {
      key,
      url: this.getPublicUrl(key),
      size: data.length,
      mimeType: opts.mimeType,
    };
  }

  getPublicUrl(key: string): string {
    // Served by /api/media/[...key]
    return `/api/media/${key.split(path.sep).join("/")}`;
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch {
      // ignore missing
    }
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }
}

/** Stub — wire AWS SDK when STORAGE_BACKEND=s3 */
class S3StorageProvider implements StorageProvider {
  async put(): Promise<StoragePutResult> {
    throw new Error("S3 storage not configured. Set credentials or use STORAGE_BACKEND=local.");
  }
  getPublicUrl(key: string): string {
    return `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${key}`;
  }
  async delete(): Promise<void> {
    throw new Error("S3 storage not configured");
  }
  async read(): Promise<Buffer> {
    throw new Error("S3 storage not configured");
  }
}

/** Stub — wire @supabase/supabase-js when STORAGE_BACKEND=supabase */
class SupabaseStorageProvider implements StorageProvider {
  async put(): Promise<StoragePutResult> {
    throw new Error("Supabase storage not configured. Use STORAGE_BACKEND=local for MVP.");
  }
  getPublicUrl(key: string): string {
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET}/${key}`;
  }
  async delete(): Promise<void> {
    throw new Error("Supabase storage not configured");
  }
  async read(): Promise<Buffer> {
    throw new Error("Supabase storage not configured");
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "application/pdf": ".pdf",
  };
  return map[mime] || "";
}

export function getStorage(): StorageProvider {
  const backend = (process.env.STORAGE_BACKEND || "local").toLowerCase();
  switch (backend) {
    case "s3":
      return new S3StorageProvider();
    case "supabase":
      return new SupabaseStorageProvider();
    case "local":
    default:
      return new LocalStorageProvider();
  }
}
