import type { ClipRect, IntentType, MemoryEntities } from "@/types";

export type VaultMediaType = "image" | "video" | "clip" | "snapshot" | "audio";

export type VaultSource =
  | "camera"
  | "clip"
  | "snapshot"
  | "share"
  | "paste"
  | "import"
  | "upload"
  | "voice"
  | "extension"
  | "screenshot";

export type VaultSyncState = "local" | "queued" | "synced" | "conflict" | "missing";

export type CloudProviderId =
  | "google_drive"
  | "onedrive"
  | "local_folder"
  | "icloud_files"
  | "none";

export interface VaultMeta {
  schemaVersion: number;
  deviceId: string;
  cloudProvider: CloudProviderId;
  cloudFolderId: string | null;
  cloudFolderName: string | null;
  lastSyncAt: string | null;
  userId: string | null;
}

export interface VaultProject {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  clientName: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface VaultMemory {
  id: string;
  title: string;
  description: string | null;
  mediaType: VaultMediaType;
  mimeType: string | null;
  fileSize: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  localPath: string | null;
  thumbPath: string | null;
  cloudPath: string | null;
  cloudThumbPath: string | null;
  syncState: VaultSyncState;
  contentHash: string | null;
  transcript: string | null;
  rawVoiceNote: string | null;
  intent: IntentType | null;
  aiSummary: string | null;
  objects: string[];
  tags: string[];
  entities: MemoryEntities;
  ocrText: string | null;
  projectId: string | null;
  projectSuggested: string | null;
  source: VaultSource;
  sourceUrl: string | null;
  sourceTitle: string | null;
  clipRect: ClipRect | null;
  latitude: number | null;
  longitude: number | null;
  placeName: string | null;
  locationSource: string | null;
  searchText: string;
  status: "processing" | "ready" | "failed";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  /** Object URL for UI — revoked on delete */
  localBlobUrl?: string | null;
  thumbBlobUrl?: string | null;
}

export interface VaultFileBlob {
  memoryId: string;
  kind: "media" | "thumb" | "frame";
  frameIndex?: number;
  blob: Blob;
  mimeType: string;
  relativePath: string;
}

export interface SyncQueueItem {
  id: string;
  memoryId: string;
  action: "push" | "pull" | "delete";
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  createdAt: string;
}

export interface VaultLocation {
  provider: CloudProviderId;
  folderId: string;
  folderName: string;
  displayPath: string;
}

export interface RemoteRef {
  id: string;
  name: string;
  path: string;
  mimeType?: string;
  size?: number;
  modifiedTime?: string;
}

export type ChangeHandler = (refs: RemoteRef[]) => void;
export type Unsubscribe = () => void;

export interface VaultSyncAdapter {
  id: CloudProviderId;
  label: string;
  connect(): Promise<VaultLocation>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;
  getLocation(): Promise<VaultLocation | null>;
  push(relativePath: string, data: Blob, mimeType: string): Promise<RemoteRef>;
  pull(relativePath: string): Promise<Blob | null>;
  list(prefix?: string): Promise<RemoteRef[]>;
  remove?(relativePath: string): Promise<void>;
  watch?(onChange: ChangeHandler): Unsubscribe;
}

export interface CreateMemoryInput {
  mediaType: VaultMediaType;
  source: VaultSource;
  file?: File | Blob | null;
  fileName?: string;
  mimeType?: string;
  thumb?: Blob | null;
  frames?: Blob[];
  transcript?: string;
  projectId?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  clipRect?: ClipRect | null;
  latitude?: number | null;
  longitude?: number | null;
  placeName?: string | null;
  locationSource?: string | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
}

export const VAULT_SCHEMA_VERSION = 1;
export const FREE_VAULT_LIMIT = 100;
export const FREE_VIDEO_MAX_MS = 30_000;
export const PRO_VIDEO_MAX_MS = 5 * 60_000;
