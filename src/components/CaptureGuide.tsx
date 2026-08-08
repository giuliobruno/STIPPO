"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { GuideClip } from "@/components/GuideClip";
import type { GuideClipId } from "@/lib/guide-clips";

export function CaptureGuide() {
  const g = useT().guide;

  const clips: { id: GuideClipId; title: string; steps: string[] }[] = [
    {
      id: "photo",
      title: g.cameraTitle,
      steps: [g.camera1, g.camera2, g.camera3, g.camera4],
    },
    {
      id: "paste",
      title: g.pasteTitle,
      steps: [g.paste1, g.paste2, g.paste3],
    },
    {
      id: "vault",
      title: g.multiTitle,
      steps: [g.multi1, g.multi2, g.multi3],
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          {g.back}
        </Link>
        <h2 className="vm-page-title">{g.title}</h2>
        <p className="vm-page-sub">{g.intro}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-1">
        {clips.map((clip) => (
          <GuideClip
            key={clip.id}
            id={clip.id}
            title={clip.title}
            steps={clip.steps}
            videoSoon={g.videoSoon}
          />
        ))}
      </div>

      <p className="text-center text-sm text-[var(--ink-muted)]">
        <Link href="/app/vault" className="font-medium text-[var(--accent)] hover:underline">
          {g.multi1}
        </Link>
      </p>

      <Link href="/app/capture" className="vm-btn-primary w-full !py-3.5">
        {g.backCta}
      </Link>
    </div>
  );
}
