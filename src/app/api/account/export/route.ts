import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseJsonArray, parseJsonObject } from "@/lib/utils";

/** GDPR-style data portability export (JSON). */
export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        memoryCount: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            id: true,
            name: true,
            description: true,
            location: true,
            clientName: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        memories: {
          select: {
            id: true,
            title: true,
            description: true,
            mediaType: true,
            mimeType: true,
            syncStatus: true,
            originalSyncEnabled: true,
            transcript: true,
            rawVoiceNote: true,
            aiSummary: true,
            tagsJson: true,
            objectsJson: true,
            entitiesJson: true,
            ocrText: true,
            intent: true,
            projectId: true,
            location: true,
            placeName: true,
            latitude: true,
            longitude: true,
            locationSource: true,
            source: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      format: "visual-memory-export-v1",
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        memoryCount: user.memoryCount,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      projects: user.projects.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      memories: user.memories.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        mediaType: m.mediaType,
        mimeType: m.mimeType,
        syncStatus: m.syncStatus,
        originalSyncEnabled: m.originalSyncEnabled,
        transcript: m.transcript,
        rawVoiceNote: m.rawVoiceNote,
        aiSummary: m.aiSummary,
        tags: parseJsonArray(m.tagsJson),
        objects: parseJsonArray(m.objectsJson),
        entities: parseJsonObject(m.entitiesJson, {}),
        ocrText: m.ocrText,
        intent: m.intent,
        projectId: m.projectId,
        location: m.location,
        placeName: m.placeName,
        latitude: m.latitude,
        longitude: m.longitude,
        locationSource: m.locationSource,
        source: m.source,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="visual-memory-export-${user.id}.json"`,
      },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status }
    );
  }
}
