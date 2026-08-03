"use client";

import Link from "next/link";
import { Crop, Globe, MonitorSmartphone, Share2 } from "lucide-react";

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
            <strong className="text-[var(--ink)]">Pick image &amp; clip</strong> only
            opens your files. To crop an image already open in another browser tab,
            use the <strong className="text-[var(--ink)]">Stippo Clip</strong>{" "}
            extension on that tab.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-3">
        <p className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
          <Globe className="h-3.5 w-3.5" />
          Image open in another browser window?
        </p>
        <ol className="list-decimal space-y-1 pl-4 text-xs text-[var(--ink-muted)]">
          <li>
            Install once: Chrome →{" "}
            <code className="text-[var(--ink)]">chrome://extensions</code> →
            Developer mode → Load unpacked → folder{" "}
            <code className="text-[var(--ink)]">extensions/chrome</code>
          </li>
          <li>
            On the site tab: click the Stippo Clip icon (or press{" "}
            <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>)
          </li>
          <li>Drag a rectangle over the detail → Stippo opens with the clip</li>
        </ol>
        <Link
          href="/app/clip-anywhere"
          className="mt-2 inline-flex text-xs font-medium text-[var(--accent)]"
        >
          Install steps →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Crop className="h-3.5 w-3.5 text-[var(--accent)]" />
            Computer (not the browser)
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            PDF, Teams, Photos…: OS screenshot → paste here (
            <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>) → drag region.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
          <p className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Share2 className="h-3.5 w-3.5 text-[var(--accent)]" />
            Phone
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            Screenshot → Share → Visual Memory, or pick the screenshot from the
            gallery.
          </p>
        </div>
      </div>
    </div>
  );
}
