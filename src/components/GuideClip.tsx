"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import {
  guideClipPoster,
  guideClipSrc,
  type GuideClipId,
} from "@/lib/guide-clips";

type GuideClipProps = {
  id: GuideClipId;
  title: string;
  steps: string[];
  videoSoon: string;
};

/**
 * Short how-to card: real UI screen recording when /public/guides/{id}.mp4 exists,
 * otherwise a numbered checklist placeholder ready for the clip.
 */
export function GuideClip({ id, title, steps, videoSoon }: GuideClipProps) {
  const [hasVideo, setHasVideo] = useState(false);
  const src = guideClipSrc(id);
  const poster = guideClipPoster(id);

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setHasVideo(res.ok);
      })
      .catch(() => {
        if (!cancelled) setHasVideo(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <article className="overflow-hidden rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
      <div className="relative aspect-video bg-[var(--paper-2)]">
        {hasVideo ? (
          <video
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            poster={poster}
            src={src}
            onError={() => setHasVideo(false)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Play className="h-5 w-5 fill-current" />
            </span>
            <p className="max-w-[16rem] text-xs font-medium leading-relaxed text-[var(--ink-muted)]">
              {videoSoon}
            </p>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
          {title}
        </h3>
        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li
              key={`${id}-${i}`}
              className="flex gap-2.5 text-sm leading-relaxed text-[var(--ink-muted)]"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent)]">
                {i + 1}
              </span>
              <span className="text-[var(--ink)]">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
