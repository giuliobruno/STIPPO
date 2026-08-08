"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export function CaptureGuide() {
  const g = useT().guide;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          {g.back}
        </Link>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">{g.title}</h2>
        <p className="text-sm text-[var(--ink-muted)]">{g.intro}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {g.cameraTitle}
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>{g.camera1}</li>
          <li>{g.camera2}</li>
          <li>{g.camera3}</li>
          <li>{g.camera4}</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {g.pasteTitle}
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>{g.paste1}</li>
          <li>{g.paste2}</li>
          <li>{g.paste3}</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          {g.multiTitle}
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>
            <Link href="/app/vault" className="text-[var(--accent)]">
              {g.multi1}
            </Link>
          </li>
          <li>{g.multi2}</li>
          <li>{g.multi3}</li>
        </ol>
      </section>

      <Link href="/app/capture" className="vm-btn-primary">
        {g.backCta}
      </Link>
    </div>
  );
}
