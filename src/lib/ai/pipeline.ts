import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import {
  analyzeImage,
  analyzeTranscript,
  embedText,
  mergeAnalyses,
} from "@/lib/ai/analyze";

export interface ProcessMemoryInput {
  memoryId: string;
  userId: string;
  imageBuffer?: Buffer;
  imageMime?: string;
  voiceTranscript?: string;
  projectHints?: string[];
  placeHint?: string;
}

/**
 * AI processing pipeline for a captured memory.
 * Image + optional native-STT transcript → structured Memory fields + embedding.
 */
export async function processMemory(input: ProcessMemoryInput) {
  const { memoryId, userId } = input;

  try {
    await prisma.memory.update({
      where: { id: memoryId },
      data: { status: "processing" },
    });

    const projects = await prisma.project.findMany({
      where: { userId, status: "active" },
      select: { name: true },
    });
    const hints = [
      ...(input.projectHints || []),
      ...projects.map((p) => p.name),
    ];

    let imageResult = null;
    if (input.imageBuffer && input.imageMime) {
      const b64 = input.imageBuffer.toString("base64");
      imageResult = await analyzeImage(b64, input.imageMime, {
        voiceTranscript: input.voiceTranscript,
        projectHints: hints,
      });
    }

    let audioResult = null;
    if (input.voiceTranscript?.trim()) {
      audioResult = await analyzeTranscript(input.voiceTranscript, hints);
    }

    const merged = await mergeAnalyses(imageResult, audioResult);
    const searchText = [merged.searchText, input.placeHint]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const embedding = await embedText(searchText);

    // Auto-link project if AI suggested a known name
    let projectId: string | undefined;
    if (merged.projectSuggested) {
      const match = await prisma.project.findFirst({
        where: {
          userId,
          name: { contains: merged.projectSuggested },
        },
      });
      if (match) projectId = match.id;
    }

    const updated = await prisma.memory.update({
      where: { id: memoryId },
      data: {
        title: merged.title,
        description: merged.description,
        aiSummary: merged.aiSummary,
        objectsJson: JSON.stringify(merged.objects),
        tagsJson: JSON.stringify(merged.tags),
        entitiesJson: JSON.stringify(merged.entities),
        ocrText: merged.ocrText || null,
        transcript: merged.transcript || input.voiceTranscript || null,
        intent: merged.intent || null,
        projectSuggested: merged.projectSuggested || null,
        projectId: projectId || undefined,
        searchText,
        embeddingJson: embedding ? JSON.stringify(embedding) : null,
        status: "ready",
        errorMessage: null,
      },
    });

    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await prisma.memory.update({
      where: { id: memoryId },
      data: { status: "failed", errorMessage: message },
    });
    throw err;
  }
}

export async function loadMemoryMedia(originalKey: string): Promise<Buffer> {
  return getStorage().read(originalKey);
}
