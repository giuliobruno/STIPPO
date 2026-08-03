"use client";

import Link from "next/link";
import { Crop, MonitorSmartphone, Share2 } from "lucide-react";

/**
 * How to clip a detail from anywhere: browser, PDF, Teams, Photos, etc.
 */
export function ClipAnywhereGuide() {
  return (
    <div className="vm-card space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
          <MonitorSmartphone className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-[var(--ink)]">Clip from anywhere</p>
          <p className="text-sm text-[var(--ink-muted)]">
            Website, PDF, Teams call, Photos, CAD preview — grab the screen, then
            crop the detail in Stippo.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Crop className="h-3.5 w-3.5 text-[var(--accent)]" />
            Computer
          </p>
          <ul className="space-y-1.5 text-xs text-[var(--ink-muted)]">
            <li>
              <strong className="text-[var(--ink)]">Any app</strong> (PDF, Teams,
              Photos…): OS screenshot → paste here (
              <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>) → drag region.
            </li>
            <li>
              <strong className="text-[var(--ink)]">Browser tab</strong>: Stippo Clip
              extension → drag on the page (or{" "}
              <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>).
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Share2 className="h-3.5 w-3.5 text-[var(--accent)]" />
            Phone
          </p>
          <ul className="space-y-1.5 text-xs text-[var(--ink-muted)]">
            <li>
              Screenshot in Teams / PDF / Safari / Photos →{" "}
              <strong className="text-[var(--ink)]">Share → Visual Memory</strong>{" "}
              → drag region.
            </li>
            <li>
              Or tap <strong className="text-[var(--ink)]">Create clip</strong> and
              pick the screenshot from the gallery.
            </li>
          </ul>
        </div>
      </div>

      <Link
        href="/app/clip-anywhere"
        className="inline-flex text-xs font-medium text-[var(--accent)]"
      >
        Full clip-from-anywhere guide →
      </Link>
    </div>
  );
}
