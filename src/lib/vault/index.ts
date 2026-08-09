import {
  enqueueSync,
  ensureVaultDb,
  getBlob,
  getMemory,
  getMeta,
  listMemories,
  listProjects,
  memoryCount,
  putBlob,
  putMemory,
  putProject,
  setMeta,
  deleteMemoryRecord,
} from "@/lib/vault/idb";
import { hashBlob, mediaExtension, newId } from "@/lib/vault/hash";
import { searchVaultMemories } from "@/lib/vault/search";
import type {
  CreateMemoryInput,
  VaultMemory,
  VaultMeta,
  VaultProject,
  VaultSyncState,
} from "@/lib/vault/types";
import { FREE_VAULT_LIMIT } from "@/lib/vault/types";
import type { MemoryAnalysisResult, MemoryEntities, SearchHit } from "@/types";

const emptyEntities = (): MemoryEntities => ({
  materials: [],
  people: [],
  companies: [],
  locations: [],
  concepts: [],
  projects: [],
});

export async function initVault(userId?: string | null): Promise<VaultMeta> {
  await ensureVaultDb();
  if (userId) return setMeta({ userId });
  return getMeta();
}

export async function getVaultMeta(): Promise<VaultMeta> {
  return getMeta();
}

export async function updateVaultMeta(
  patch: Partial<VaultMeta>
): Promise<VaultMeta> {
  return setMeta(patch);
}

export async function countVaultMemories(): Promise<number> {
  return memoryCount();
}

export async function assertVaultCanCreate(isPro: boolean): Promise<void> {
  if (isPro) return;
  const n = await memoryCount();
  if (n >= FREE_VAULT_LIMIT) {
    const err = new Error(
      `Free plan limit reached (${FREE_VAULT_LIMIT} memories). Upgrade to Pro for unlimited.`
    ) as Error & { status: number };
    err.status = 402;
    throw err;
  }
}

/**
 * Create a memory in the local vault (media + thumb), mark queued for sync.
 * AI enrichment is applied later via applyAnalysis().
 */
export async function createVaultMemory(
  input: CreateMemoryInput
): Promise<VaultMemory> {
  await ensureVaultDb();
  const id = newId();
  const now = new Date().toISOString();
  const mime =
    input.mimeType ||
    input.file?.type ||
    (input.mediaType === "link" ? "text/uri-list" : "application/octet-stream");
  const ext = mediaExtension(mime, input.mediaType);
  const localPath = input.file ? `media/${id}${ext}` : null;
  const thumbPath = input.thumb ? `thumbs/${id}.jpg` : null;

  let contentHash: string | null = null;
  if (input.file) {
    contentHash = await hashBlob(input.file);
    await putBlob(localPath!, input.file, { memoryId: id, kind: "media" });
  }
  if (input.thumb) {
    await putBlob(thumbPath!, input.thumb, { memoryId: id, kind: "thumb" });
  }
  if (input.frames?.length) {
    for (let i = 0; i < input.frames.length; i++) {
      await putBlob(`frames/${id}-${i}.jpg`, input.frames[i], {
        memoryId: id,
        kind: "frame",
      });
    }
  }

  const memory: VaultMemory = {
    id,
    title:
      (input.mediaType === "link" || input.mediaType === "document") &&
      input.sourceTitle?.trim()
        ? input.sourceTitle.trim()
        : input.fileName?.trim() || "Processing…",
    description: null,
    mediaType: input.mediaType,
    mimeType: mime,
    fileSize: input.file?.size ?? null,
    durationMs: input.durationMs ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    localPath,
    thumbPath,
    cloudPath: null,
    cloudThumbPath: null,
    syncState: "local",
    contentHash,
    transcript: input.transcript?.trim() || null,
    rawVoiceNote: input.transcript?.trim() || null,
    intent: null,
    aiSummary: null,
    objects: [],
    tags: [],
    entities: emptyEntities(),
    ocrText: null,
    projectId: input.projectId ?? null,
    projectSuggested: null,
    source: input.source,
    sourceUrl: input.sourceUrl ?? null,
    sourceTitle:
      input.sourceTitle?.trim() ||
      (input.mediaType === "document" ? input.fileName?.trim() || null : null),
    clipRect: input.clipRect ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    placeName: input.placeName ?? null,
    locationSource: input.locationSource ?? null,
    searchText: [
      input.transcript,
      input.sourceUrl,
      input.sourceTitle,
      input.fileName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    status: "processing",
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
  };

  await putMemory(memory);
  await enqueuePush(memory.id);
  return hydrateUrls(memory);
}

export async function applyAnalysis(
  memoryId: string,
  analysis: MemoryAnalysisResult,
  opts?: { projectId?: string | null }
): Promise<VaultMemory> {
  const existing = await getMemory(memoryId);
  if (!existing) throw new Error("Memory not found in vault");

  const searchText = [
    analysis.searchText,
    existing.placeName,
    existing.sourceTitle,
    existing.sourceUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const updated: VaultMemory = {
    ...existing,
    title: analysis.title || existing.title,
    description: analysis.description || null,
    aiSummary: analysis.aiSummary || null,
    objects: analysis.objects,
    tags: analysis.tags,
    entities: analysis.entities,
    ocrText: analysis.ocrText || null,
    transcript: analysis.transcript || existing.transcript,
    intent: analysis.intent || null,
    projectSuggested: analysis.projectSuggested || null,
    projectId: opts?.projectId ?? existing.projectId,
    sourceTitle:
      existing.sourceTitle ||
      (existing.mediaType === "link" ? analysis.title || null : existing.sourceTitle),
    searchText,
    status: "ready",
    errorMessage: null,
    updatedAt: new Date().toISOString(),
    syncState: existing.syncState === "synced" ? "queued" : existing.syncState,
  };

  await putMemory(updated);
  await enqueuePush(memoryId);
  return hydrateUrls(updated);
}

export async function markMemoryFailed(
  memoryId: string,
  message: string
): Promise<void> {
  const existing = await getMemory(memoryId);
  if (!existing) return;
  await putMemory({
    ...existing,
    status: "failed",
    errorMessage: message,
    updatedAt: new Date().toISOString(),
  });
}

export async function setMemorySyncState(
  memoryId: string,
  syncState: VaultSyncState,
  paths?: { cloudPath?: string; cloudThumbPath?: string }
): Promise<void> {
  const existing = await getMemory(memoryId);
  if (!existing) return;
  await putMemory({
    ...existing,
    syncState,
    cloudPath: paths?.cloudPath ?? existing.cloudPath,
    cloudThumbPath: paths?.cloudThumbPath ?? existing.cloudThumbPath,
    updatedAt: new Date().toISOString(),
  });
}

export async function getVaultMemory(id: string): Promise<VaultMemory | null> {
  const m = await getMemory(id);
  return m ? hydrateUrls(m) : null;
}

export async function listVaultMemories(opts?: {
  projectId?: string;
  limit?: number;
}): Promise<VaultMemory[]> {
  const rows = await listMemories(opts);
  return Promise.all(rows.map(hydrateUrls));
}

export async function deleteVaultMemory(id: string): Promise<void> {
  const m = await getMemory(id);
  if (m?.localBlobUrl) URL.revokeObjectURL(m.localBlobUrl);
  if (m?.thumbBlobUrl) URL.revokeObjectURL(m.thumbBlobUrl);
  await deleteMemoryRecord(id);
  await enqueueSync({
    memoryId: id,
    action: "delete",
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    createdAt: new Date().toISOString(),
  });
}

export async function searchVault(
  query: string,
  opts?: { projectId?: string; limit?: number }
): Promise<SearchHit[]> {
  const memories = await listVaultMemories({ limit: 500 });
  const hits = searchVaultMemories(memories, query, opts);
  const projects = await listProjects();
  const byId = new Map(projects.map((p) => [p.id, p.name]));
  return hits.map((h) => {
    const mem = memories.find((m) => m.id === h.id);
    return {
      ...h,
      projectName: mem?.projectId ? byId.get(mem.projectId) ?? null : null,
    };
  });
}

export async function upsertVaultProject(
  input: Omit<VaultProject, "createdAt" | "updatedAt" | "id" | "status"> & {
    id?: string;
    status?: VaultProject["status"];
  }
): Promise<VaultProject> {
  const now = new Date().toISOString();
  const project: VaultProject = {
    id: input.id || newId(),
    name: input.name,
    description: input.description ?? null,
    location: input.location ?? null,
    clientName: input.clientName ?? null,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };
  await putProject(project);
  return project;
}

export async function listVaultProjects(): Promise<VaultProject[]> {
  return listProjects();
}

export async function readVaultBlob(relativePath: string): Promise<Blob | null> {
  return getBlob(relativePath);
}

async function hydrateUrls(m: VaultMemory): Promise<VaultMemory> {
  let localBlobUrl: string | null = null;
  let thumbBlobUrl: string | null = null;
  if (m.localPath) {
    const b = await getBlob(m.localPath);
    if (b) localBlobUrl = URL.createObjectURL(b);
  }
  if (m.thumbPath) {
    const b = await getBlob(m.thumbPath);
    if (b) thumbBlobUrl = URL.createObjectURL(b);
  }
  return { ...m, localBlobUrl, thumbBlobUrl };
}

async function enqueuePush(memoryId: string) {
  await enqueueSync({
    memoryId,
    action: "push",
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    createdAt: new Date().toISOString(),
  });
  const m = await getMemory(memoryId);
  if (m && m.syncState === "local") {
    await putMemory({ ...m, syncState: "queued" });
  }
}

/**
 * Call server AI gateway — bytes are transient, never stored server-side.
 */
export async function analyzeViaGateway(opts: {
  imageBlob?: Blob | null;
  mimeType?: string;
  transcript?: string;
  url?: string | null;
  documentBlob?: Blob | null;
  fileName?: string | null;
  projectHints?: string[];
}): Promise<MemoryAnalysisResult> {
  const form = new FormData();
  if (opts.imageBlob) {
    form.append(
      "image",
      opts.imageBlob,
      `frame.${(opts.mimeType || "image/jpeg").split("/")[1] || "jpg"}`
    );
  }
  if (opts.documentBlob) {
    form.append(
      "document",
      opts.documentBlob,
      opts.fileName || "document.bin"
    );
  }
  if (opts.fileName?.trim()) form.append("fileName", opts.fileName.trim());
  if (opts.mimeType && !opts.imageBlob) {
    form.append("mimeType", opts.mimeType);
  }
  if (opts.transcript) form.append("transcript", opts.transcript);
  if (opts.url?.trim()) form.append("url", opts.url.trim());
  if (opts.projectHints?.length) {
    form.append("projectHints", JSON.stringify(opts.projectHints));
  }

  const res = await fetch("/api/ai/analyze", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "AI analysis failed");
  }
  return data.analysis as MemoryAnalysisResult;
}
