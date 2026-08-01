import { prisma } from "@/lib/prisma";
import { cosineSimilarity, parseEmbedding, parseJsonArray } from "@/lib/utils";
import { embedText } from "@/lib/ai/analyze";
import { getStorage } from "@/lib/storage";
import type { SearchHit } from "@/types";

export interface SearchOptions {
  userId: string;
  query: string;
  projectId?: string;
  limit?: number;
}

/**
 * Hybrid search: keyword match on denormalized searchText + semantic cosine on embeddings.
 * MVP runs in-process; production can swap to pgvector / Pinecone without changing the API.
 */
export async function searchMemories(opts: SearchOptions): Promise<SearchHit[]> {
  const limit = opts.limit ?? 24;
  const q = opts.query.trim();
  if (!q) return [];

  const memories = await prisma.memory.findMany({
    where: {
      userId: opts.userId,
      status: "ready",
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
    },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const queryEmbedding = await embedText(q);
  const keywords = q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const storage = getStorage();

  const scored = memories.map((m) => {
    const hay = (m.searchText || `${m.title} ${m.description || ""} ${m.transcript || ""}`).toLowerCase();
    let keywordScore = 0;
    for (const kw of keywords) {
      if (hay.includes(kw)) keywordScore += 1;
    }
    keywordScore = keywords.length ? keywordScore / keywords.length : 0;

    const emb = parseEmbedding(m.embeddingJson);
    const semanticScore =
      queryEmbedding && emb ? cosineSimilarity(queryEmbedding, emb) : 0;

    // Weighted hybrid
    const score = keywordScore * 0.45 + semanticScore * 0.55;

    return {
      id: m.id,
      title: m.title,
      description: m.description,
      thumbnailUrl: m.thumbnailKey
        ? storage.getPublicUrl(m.thumbnailKey)
        : m.originalKey && m.mediaType === "image"
          ? storage.getPublicUrl(m.originalKey)
          : null,
      tags: parseJsonArray(m.tagsJson),
      projectName: m.project?.name ?? null,
      score,
      createdAt: m.createdAt.toISOString(),
    } satisfies SearchHit;
  });

  return scored
    .filter((h) => h.score > 0.08 || keywords.some((kw) => h.title.toLowerCase().includes(kw)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
