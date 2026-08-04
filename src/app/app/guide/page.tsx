import Link from "next/link";

/** How-to for work vault capture */
export default function CaptureGuidePage() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div className="space-y-2">
        <Link href="/app/capture" className="vm-btn-ghost !px-0">
          ← Capture
        </Link>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">How to capture</h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Stippo is a <strong>work vault</strong> — not your personal album. Capture
          here so project references stay separate and sync to your Drive.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          Work camera (recommended)
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>Open Capture → <strong>Photo</strong> or <strong>Video</strong></li>
          <li>Shoot the reference on site or in studio</li>
          <li>Speak or type a note (optional — AI still tags the image)</li>
          <li>Save → lands in your local vault, then syncs to your cloud folder</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          Screenshot / clip
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>
            Android: Add Stippo to Home screen → screenshot → <strong>Share → Stippo</strong>
          </li>
          <li>Desktop: paste screenshot (Ctrl/Cmd+V) → crop detail</li>
          <li>Add a note → save</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          Multi-device
        </h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>
            Open <Link href="/app/vault" className="text-[var(--accent)]">Vault settings</Link>
          </li>
          <li>Connect Google Drive (or a local sync folder on desktop)</li>
          <li>On another device: same cloud → <strong>Pull</strong></li>
        </ol>
      </section>

      <Link href="/app/capture" className="vm-btn-primary">
        Back to Capture
      </Link>
    </div>
  );
}
