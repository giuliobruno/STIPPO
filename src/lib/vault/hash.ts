/** SHA-256 hex of blob bytes — for dedup / integrity. */
export async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `vm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function mediaExtension(mimeType: string, mediaType: string): string {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return ".jpg";
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("quicktime")) return ".mov";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("m4a") || mimeType.includes("mp4a")) return ".m4a";
  if (mimeType.includes("wav")) return ".wav";
  if (mediaType === "video") return ".mp4";
  if (mediaType === "audio") return ".m4a";
  return ".bin";
}
