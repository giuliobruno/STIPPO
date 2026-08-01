import Link from "next/link";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-8">
        <header className="mb-10 flex items-center justify-between gap-4">
          <Link href="/" className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Visual Memory
          </Link>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/privacy" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Privacy
            </Link>
            <Link href="/terms" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Terms
            </Link>
            <Link href="/disclaimer" className="text-[var(--ink-muted)] hover:text-[var(--ink)]">
              Disclaimers
            </Link>
            <Link href="/app/account" className="text-[var(--accent)] hover:underline">
              Account
            </Link>
          </div>
        </header>

        <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Last updated: 1 August 2026
        </p>

        <article className="prose-legal mt-10 space-y-6 text-[15px] leading-relaxed text-[var(--ink)]">
          {children}
        </article>
      </div>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-[family-name:var(--font-serif)] text-2xl">{title}</h2>
      <div className="space-y-3 text-[var(--ink-muted)]">{children}</div>
    </section>
  );
}
