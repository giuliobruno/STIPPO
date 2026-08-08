import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { assertCanCreateMemory, requireUser } from "@/lib/session";
import { processMemory } from "@/lib/ai/pipeline";
import { parseJsonArray, parseJsonObject } from "@/lib/utils";
import { isProPlan } from "@/lib/stripe";
import { serverMediaUploadsEnabled } from "@/lib/env";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_UPLOAD_PREFIXES = ["image/", "audio/", "application/pdf"];

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    const memories = await prisma.memory.findMany({
      where: {
        userId: user.id,
        ...(projectId ? { projectId } : {}),
      },
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const storage = getStorage();
    return NextResponse.json({
      memories: memories.map((m) =>
        serializeMemory(m, storage.getPublicUrl.bind(storage))
      ),
    });
  } catch (err) {
    return handleErr(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    if (!serverMediaUploadsEnabled()) {
      return NextResponse.json(
        {
          error:
            "Server media uploads are disabled. Use the local work vault (BYOS) capture path.",
        },
        { status: 410 }
      );
    }

    const dbUser = await assertCanCreateMemory(user.id);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const thumbFile = form.get("thumbnail") as File | null;
    const transcript = String(form.get("transcript") || "").trim();
    const source = String(form.get("source") || "upload");
    const projectId = String(form.get("projectId") || "") || null;
    const voiceOnly = form.get("voiceOnly") === "true";
    const syncOriginal = form.get("syncOriginal") === "true";
    const latitude = parseOptionalFloat(form.get("latitude"));
    const longitude = parseOptionalFloat(form.get("longitude"));
    const placeName = String(form.get("placeName") || "").trim() || null;
    const locationSource = String(form.get("locationSource") || "").trim() || null;
    const sourceUrl = String(form.get("sourceUrl") || "").trim() || null;
    const sourceTitle = String(form.get("sourceTitle") || "").trim() || null;
    const clipRectRaw = String(form.get("clipRect") || "").trim();
    const clipRectJson = sanitizeClipRectJson(clipRectRaw);

    // Pro-only: sync full-res original across devices
    const originalSyncEnabled = syncOriginal && isProPlan(dbUser);

    if (!file && !transcript) {
      return NextResponse.json(
        { error: "Provide an image/file and/or a voice transcript." },
        { status: 400 }
      );
    }

    if (file) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: "File too large (max 12MB)." },
          { status: 413 }
        );
      }
      const mime = (file.type || "").toLowerCase();
      if (
        mime &&
        !ALLOWED_UPLOAD_PREFIXES.some(
          (p) => mime === p || (p.endsWith("/") && mime.startsWith(p))
        )
      ) {
        return NextResponse.json(
          { error: "Unsupported file type." },
          { status: 415 }
        );
      }
    }

    const storage = getStorage();
    let originalKey = "";
    let thumbnailKey: string | null = null;
    let mimeType = "application/octet-stream";
    let fileSize = 0;
    let mediaType: "image" | "audio" | "document" = "image";
    let imageBuffer: Buffer | undefined;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || "application/octet-stream";
      fileSize = buffer.length;
      mediaType = mimeType.startsWith("image/")
        ? "image"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "document";

      const stored = await storage.put(user.id, buffer, {
        filename: file.name || "capture",
        mimeType,
        folder: "originals",
      });
      originalKey = stored.key;
      if (mediaType === "image") imageBuffer = buffer;
    } else if (voiceOnly && transcript) {
      mediaType = "audio";
      originalKey = `voice:${Date.now()}`;
    }

    // Hybrid Plan B: always store a lightweight thumbnail when provided
    if (thumbFile && mediaType === "image") {
      const thumbBuf = Buffer.from(await thumbFile.arrayBuffer());
      const thumb = await storage.put(user.id, thumbBuf, {
        filename: "thumb.jpg",
        mimeType: "image/jpeg",
        folder: "thumbnails",
      });
      thumbnailKey = thumb.key;
    } else if (mediaType === "image" && originalKey) {
      thumbnailKey = originalKey;
    }

    const locationLabel =
      placeName ||
      (latitude != null && longitude != null
        ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        : null);

    const memory = await prisma.memory.create({
      data: {
        userId: user.id,
        title: "Processing…",
        description: null,
        mediaType,
        originalKey,
        thumbnailKey,
        mimeType,
        fileSize,
        storageBackend: process.env.STORAGE_BACKEND || "local",
        syncStatus: originalSyncEnabled ? "full_synced" : "indexed",
        originalSyncEnabled,
        rawVoiceNote: transcript || null,
        projectId,
        source,
        sourceUrl,
        sourceTitle,
        clipRectJson,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        placeName: locationLabel,
        locationSource: locationSource || undefined,
        location: locationLabel,
        status: "processing",
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { memoryCount: { increment: 1 } },
    });

    const processed = await processMemory({
      memoryId: memory.id,
      userId: user.id,
      imageBuffer,
      imageMime: mimeType.startsWith("image/") ? mimeType : undefined,
      voiceTranscript: transcript || undefined,
      placeHint: locationLabel || undefined,
    });

    return NextResponse.json({
      memory: serializeMemory(
        { ...processed, project: null },
        storage.getPublicUrl.bind(storage)
      ),
    });
  } catch (err) {
    return handleErr(err);
  }
}

function parseOptionalFloat(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function serializeMemory(
  m: {
    id: string;
    title: string;
    description: string | null;
    mediaType: string;
    originalKey: string;
    thumbnailKey: string | null;
    transcript: string | null;
    aiSummary: string | null;
    tagsJson: string;
    objectsJson: string;
    entitiesJson: string;
    ocrText: string | null;
    intent: string | null;
    projectId: string | null;
    projectSuggested: string | null;
    source: string;
    sourceUrl?: string | null;
    sourceTitle?: string | null;
    clipRectJson?: string | null;
    status: string;
    createdAt: Date;
    latitude?: number | null;
    longitude?: number | null;
    placeName?: string | null;
    locationSource?: string | null;
    syncStatus?: string;
    project?: { id: string; name: string } | null;
  },
  urlFor: (key: string) => string
) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    mediaType: m.mediaType,
    imageUrl:
      m.mediaType === "image" && (m.thumbnailKey || m.originalKey)
        ? urlFor(m.thumbnailKey || m.originalKey)
        : null,
    transcript: m.transcript,
    aiSummary: m.aiSummary,
    tags: parseJsonArray(m.tagsJson),
    objects: parseJsonArray(m.objectsJson),
    entities: parseJsonObject(m.entitiesJson, {
      materials: [],
      people: [],
      companies: [],
      locations: [],
      concepts: [],
      projects: [],
    }),
    ocrText: m.ocrText,
    intent: m.intent,
    projectId: m.projectId,
    projectName: m.project?.name ?? null,
    projectSuggested: m.projectSuggested,
    source: m.source,
    sourceUrl: m.sourceUrl ?? null,
    sourceTitle: m.sourceTitle ?? null,
    clipRect: parseClipRect(m.clipRectJson),
    status: m.status,
    latitude: m.latitude ?? null,
    longitude: m.longitude ?? null,
    placeName: m.placeName ?? null,
    locationSource: m.locationSource ?? null,
    syncStatus: m.syncStatus ?? "indexed",
    createdAt: m.createdAt.toISOString(),
  };
}

function sanitizeClipRectJson(raw: string): string | null {
  const rect = parseClipRect(raw);
  return rect ? JSON.stringify(rect) : null;
}

function parseClipRect(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const keys = ["x", "y", "width", "height", "imageWidth", "imageHeight"] as const;
    const out: Record<(typeof keys)[number], number> = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      imageWidth: 0,
      imageHeight: 0,
    };
    for (const k of keys) {
      const n = Number(parsed[k]);
      if (!Number.isFinite(n)) return null;
      out[k] = n;
    }
    return out;
  } catch {
    return null;
  }
}

function handleErr(err: unknown) {
  const status = (err as { status?: number })?.status || 500;
  const message = err instanceof Error ? err.message : "Server error";
  if (status === 401) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error(err);
  return NextResponse.json({ error: message }, { status });
}
