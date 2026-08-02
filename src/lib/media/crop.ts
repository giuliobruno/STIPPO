export type CropRect = {
  /** Left edge in source image pixels */
  x: number;
  /** Top edge in source image pixels */
  y: number;
  width: number;
  height: number;
  /** Full source width before crop */
  imageWidth: number;
  /** Full source height before crop */
  imageHeight: number;
};

/**
 * Crop an image File to the given pixel rectangle (canvas / ImageBitmap).
 */
export async function cropImageFile(
  file: File,
  rect: Omit<CropRect, "imageWidth" | "imageHeight">,
  mimeType = "image/png",
  quality = 0.92
): Promise<{ file: File; rect: CropRect }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Crop only supported for images");
  }

  const bitmap = await createImageBitmap(file);
  const imageWidth = bitmap.width;
  const imageHeight = bitmap.height;

  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(rect.y)));
  const width = Math.max(1, Math.min(imageWidth - x, Math.round(rect.width)));
  const height = Math.max(1, Math.min(imageHeight - y, Math.round(rect.height)));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas unavailable");
  }
  ctx.drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), mimeType, quality)
  );
  if (!blob) throw new Error("Failed to encode crop");

  const ext = mimeType === "image/jpeg" ? "jpg" : "png";
  const base = file.name.replace(/\.[^.]+$/, "") || "clip";
  const cropped = new File([blob], `${base}-clip.${ext}`, { type: mimeType });

  return {
    file: cropped,
    rect: { x, y, width, height, imageWidth, imageHeight },
  };
}
