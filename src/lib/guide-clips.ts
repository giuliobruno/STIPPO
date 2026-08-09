/** Screen-recording clip ids. Drop MP4s in /public/guides/{id}.mp4 (+ optional .jpg poster). */
export const GUIDE_CLIP_IDS = [
  "photo",
  "video",
  "paste",
  "link",
  "file",
  "crop",
  "save",
  "vault",
] as const;

export type GuideClipId = (typeof GUIDE_CLIP_IDS)[number];

export function guideClipSrc(id: GuideClipId): string {
  return `/guides/${id}.mp4`;
}

export function guideClipPoster(id: GuideClipId): string {
  return `/guides/${id}.jpg`;
}
