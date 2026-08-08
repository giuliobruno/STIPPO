"use client";

import Link from "next/link";
import { useT } from "@/i18n";

export function CaptureGuide() {
  const g = useT().guide;

  const sections = [
    {
      title: g.cameraTitle,
      items: [g.camera1, g.camera2, g.camera3, g.camera4],
    },
    {
      title: g.pasteTitle,
      items: [g.paste1, g.paste2, g.paste3],
    },
    {
      title: g.multiTitle,
      items: [g.multi1, g.multi2, g.multi3],
      linkFirst: true,
    },
  ];

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          {g.back}
        </Link>
        <h2 className="vm-page-title">{g.title}</h2>
        <p className="vm-page-sub">{g.intro}</p>
      </div>

      {sections.map((section) => (
        <section
          key={section.title}
          className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
        >
          <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--accent)]">
            {section.title}
          </h3>
          <ol className="mt-4 space-y-3">
            {section.items.map((item, i) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-[var(--ink)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-medium text-[var(--accent)]">
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  {section.linkFirst && i === 0 ? (
                    <Link href="/app/vault" className="font-medium text-[var(--accent)]">
                      {item}
                    </Link>
                  ) : (
                    item
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <Link href="/app/capture" className="vm-btn-primary w-full !py-3.5">
        {g.backCta}
      </Link>
    </div>
  );
}
