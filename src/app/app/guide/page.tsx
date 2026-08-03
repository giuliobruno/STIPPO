import Link from "next/link";

/** Short how-to for Capture — share screenshots + album photos. */
export default function CaptureGuidePage() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          ← Capture
        </Link>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">How to capture</h2>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          From your photo album
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>Open Capture → <strong>Album</strong></li>
          <li>Pick any photo</li>
          <li>Speak or type a note</li>
          <li>Optional: <strong>Crop</strong> if you only need a detail</li>
          <li>Save</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          From a screenshot (Android)
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>
            Install Stippo once: Chrome → <strong>Add to Home screen</strong>
          </li>
          <li>Take a screenshot → <strong>Share</strong> → <strong>Stippo</strong></li>
          <li>Crop if needed → add a note → save</li>
        </ol>
        <p className="text-xs text-[var(--ink-muted)]">
          iPhone: save the screenshot, then use Album in Capture (Safari cannot put
          Stippo in Share the same way).
        </p>
      </section>

      <Link href="/app/capture" className="vm-btn-primary">
        Back to Capture
      </Link>
    </div>
  );
}
