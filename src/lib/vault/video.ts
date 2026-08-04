/**
 * Extract JPEG keyframes from a video Blob for vision analysis.
 * Uses HTMLVideoElement + canvas — no ffmpeg on mobile.
 */
export async function extractVideoKeyframes(
  videoBlob: Blob,
  count = 3
): Promise<{ frames: Blob[]; durationMs: number; width: number; height: number }> {
  const url = URL.createObjectURL(videoBlob);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video"));
    });

    const durationMs = Math.round((video.duration || 0) * 1000);
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const times =
      count <= 1
        ? [0]
        : Array.from({ length: count }, (_, i) =>
            (video.duration * i) / (count - 1)
          );

    const frames: Blob[] = [];
    for (const t of times) {
      const frame = await captureFrame(video, t);
      if (frame) frames.push(frame);
    }

    return { frames, durationMs, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function captureFrame(video: HTMLVideoElement, timeSec: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      const canvas = document.createElement("canvas");
      const maxEdge = 720;
      const scale = Math.min(
        1,
        maxEdge / Math.max(video.videoWidth || 1, video.videoHeight || 1)
      );
      canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72);
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.min(timeSec, Math.max(0, video.duration - 0.05));
  });
}

/** Poster thumb from first keyframe or video start. */
export async function createVideoPoster(videoBlob: Blob): Promise<Blob | null> {
  const { frames } = await extractVideoKeyframes(videoBlob, 1);
  return frames[0] || null;
}
