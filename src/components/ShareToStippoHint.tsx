"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";

/**
 * Explains the simple phone flow: screenshot → Share → Stippo.
 * Prompts Add to Home Screen when the app is not installed as a PWA.
 */
export function ShareToStippoHint() {
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      ("standalone" in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(standalone);
  }, []);

  return (
    <div className="vm-card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
          <Share2 className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-[var(--ink)]">Share a screenshot into Stippo</p>
          <p className="text-sm text-[var(--ink-muted)]">
            On your phone: take a normal screenshot → tap{" "}
            <strong className="text-[var(--ink)]">Share</strong> → choose{" "}
            <strong className="text-[var(--ink)]">Stippo</strong>. Then crop the detail
            here and save.
          </p>
        </div>
      </div>
      {!installed ? (
        <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-xs text-[var(--ink-muted)]">
          First time: open this site in Chrome (Android) → browser menu →{" "}
          <strong className="text-[var(--ink)]">Add to Home screen</strong> / Install app.
          After that, Stippo appears in the system Share sheet.
        </p>
      ) : (
        <p className="text-xs text-[var(--ink-muted)]">
          Stippo is installed — it should show up when you share an image or screenshot.
        </p>
      )}
    </div>
  );
}
