import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { requireUser } from "@/lib/session";
import { parseJsonArray, parseJsonObject } from "@/lib/utils";
import { assertOwnedProjectId } from "@/lib/owned-project";
import { z } from "zod";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const memory = await prisma.memory.findFirst({
      where: { id: params.id, userId: user.id },
      include: { project: true },
    });
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const storage = getStorage();
    return NextResponse.json({
      memory: {
        id: memory.id,
        title: memory.title,
        description: memory.description,
        mediaType: memory.mediaType,
        imageUrl:
          memory.mediaType === "image"
            ? storage.getPublicUrl(memory.originalKey)
            : null,
        transcript: memory.transcript,
        rawVoiceNote: memory.rawVoiceNote,
        aiSummary: memory.aiSummary,
        tags: parseJsonArray(memory.tagsJson),
        objects: parseJsonArray(memory.objectsJson),
        entities: parseJsonObject(memory.entitiesJson, {
          materials: [],
          people: [],
          companies: [],
          locations: [],
          concepts: [],
          projects: [],
        }),
        ocrText: memory.ocrText,
        intent: memory.intent,
        projectId: memory.projectId,
        projectName: memory.project?.name ?? null,
        projectSuggested: memory.projectSuggested,
        source: memory.source,
        status: memory.status,
        errorMessage: memory.errorMessage,
        createdAt: memory.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  projectId: z.string().nullable().optional(),
  transcript: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.memory.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownedProjectId = await assertOwnedProjectId(user.id, body.projectId);

    const updated = await prisma.memory.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description,
        tagsJson: body.tags ? JSON.stringify(body.tags) : undefined,
        projectId: ownedProjectId === undefined ? undefined : ownedProjectId,
        transcript: body.transcript,
      },
    });

    return NextResponse.json({ id: updated.id });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const memory = await prisma.memory.findFirst({
      where: { id: params.id, userId: user.id },
    });
    if (!memory) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const storage = getStorage();
    if (memory.originalKey && !memory.originalKey.startsWith("voice:")) {
      await storage.delete(memory.originalKey);
    }
    if (memory.thumbnailKey && memory.thumbnailKey !== memory.originalKey) {
      await storage.delete(memory.thumbnailKey);
    }
    if (memory.audioKey) await storage.delete(memory.audioKey);

    await prisma.memory.delete({ where: { id: params.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { memoryCount: { decrement: 1 } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status }
    );
  }
}
