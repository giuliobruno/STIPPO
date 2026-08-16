import { hostnameFromUrl } from "@/lib/media/url";

/** Tags that repeat media type / generic AI filler — hide in UI. */
const NOISE_TAGS = new Set([
  "link",
  "bookmark",
  "reference",
  "document",
  "file",
  "web-reference",
  "document-reference",
  "architecture",
]);

export function usefulTags(
  tags: string[],
  opts?: { sourceUrl?: string | null; limit?: number }
): string[] {
  const host = hostnameFromUrl(opts?.sourceUrl)?.toLowerCase();
  const limit = opts?.limit ?? 8;
  return tags
    .filter((tag) => {
      const t = tag.trim().toLowerCase();
      if (!t || NOISE_TAGS.has(t)) return false;
      if (host && (t === host || t === `www.${host}` || host.endsWith(`.${t}`))) {
        return false;
      }
      return true;
    })
    .slice(0, limit);
}
