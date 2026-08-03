import Link from "next/link";

export default function ClipAnywherePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          ← Capture
        </Link>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">
          Clip from anywhere
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Stippo cannot inject a crop tool inside every other app (Teams, Acrobat,
          Photos…). The universal pattern is: capture the screen → crop the detail
          in Stippo. On desktop Chrome, the extension crops on the live webpage.
        </p>
      </div>

      <section className="vm-card space-y-3 p-5">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">
          Phone — any app
        </h3>
        <p className="text-sm text-[var(--ink-muted)]">
          Works from Teams, a PDF reader, the photo gallery, Maps, etc.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-muted)]">
          <li>Install Stippo to the home screen (Add to Home Screen) so it appears in Share.</li>
          <li>Take a screenshot of what you are looking at — or Share an image directly.</li>
          <li>
            Choose <strong className="text-[var(--ink)]">Visual Memory</strong> in the
            share sheet.
          </li>
          <li>Drag the region → Apply clip → annotate → save.</li>
        </ol>
        <p className="text-xs text-[var(--ink-muted)]">
          Alternative: open Stippo → Clip → pick the screenshot from your gallery.
        </p>
        <Link href="/app/capture?mode=clip" className="vm-btn-primary">
          Open Capture clip
        </Link>
      </section>

      <section className="vm-card space-y-3 p-5">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">
          Computer — any app
        </h3>
        <p className="text-sm text-[var(--ink-muted)]">
          PDF, Teams meeting, Finder/Explorer preview, Figma, CAD…
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-muted)]">
          <li>
            Screenshot a region: Windows <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>,
            Mac <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd> (copy to clipboard).
          </li>
          <li>
            Open Stippo Capture and paste (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>).
          </li>
          <li>Drag to refine the clip if needed → save.</li>
        </ol>
      </section>

      <section className="vm-card space-y-3 p-5">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">
          Computer — browser tab (live crop)
        </h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--ink-muted)]">
          <li>
            Chrome/Edge → <code className="text-[var(--ink)]">chrome://extensions</code> →
            Developer mode → Load unpacked →{" "}
            <code className="text-[var(--ink)]">extensions/chrome</code>.
          </li>
          <li>
            Popup → set App origin to your Stippo URL → Save.
          </li>
          <li>
            On any site (or in-browser PDF) → Stippo Clip, right-click{" "}
            <strong className="text-[var(--ink)]">Clip region to Stippo</strong>, or{" "}
            <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> → drag.
          </li>
        </ol>
      </section>
    </div>
  );
}
