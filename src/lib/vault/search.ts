import type { VaultMemory } from "@/lib/vault/types";
import type { SearchHit } from "@/types";

/**
 * Local FTS-like search over vault memories.
 * Scores keyword hits on searchText / title / tags / transcript / OCR.
 * No embeddings — vision tags at ingest make keyword search effective.
 */
export function searchVaultMemories(
  memories: VaultMemory[],
  query: string,
  opts?: { projectId?: string; limit?: number }
): SearchHit[] {
  const limit = opts?.limit ?? 24;
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const keywords = q.split(/\s+/).filter((w) => w.length > 1);
  const pool = opts?.projectId
    ? memories.filter((m) => m.projectId === opts.projectId)
    : memories;

  const scored = pool
    .filter((m) => m.status === "ready")
    .map((m) => {
      const hay = [
        m.searchText,
        m.title,
        m.description,
        m.transcript,
        m.ocrText,
        m.aiSummary,
        m.placeName,
        m.tags.join(" "),
        m.objects.join(" "),
        Object.values(m.entities).flat().join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let hits = 0;
      for (const kw of keywords) {
        if (hay.includes(kw)) hits += 1;
      }
      // Phrase bonus
      if (hay.includes(q)) hits += keywords.length * 0.5;

      const score = keywords.length ? hits / keywords.length : 0;
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        thumbnailUrl: m.thumbBlobUrl || m.localBlobUrl || null,
        tags: m.tags,
        projectName: null as string | null,
        score,
        createdAt: m.createdAt,
      };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
