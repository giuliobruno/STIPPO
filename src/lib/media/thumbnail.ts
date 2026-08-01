/**
 * Client-side thumbnail for Hybrid Plan B.
 * Full-res stays local; this small JPEG is what travels across devices.
 */
export async function createThumbnail(
  file: File,
  maxEdge = 720,
  quality = 0.72
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Thumbnails only supported for images");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
  if (!blob) throw new Error("Failed to encode thumbnail");
  return blob;
}
