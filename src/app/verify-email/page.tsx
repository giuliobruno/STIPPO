import Link from "next/link";
import { VerifyEmailClient } from "@/components/VerifyEmailClient";

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token || "";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]"
      >
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl">Confirm email</h1>
      <p className="mt-2 mb-8 text-sm text-[var(--ink-muted)]">
        Activating your Stippo account…
      </p>
      <VerifyEmailClient token={token} />
    </div>
  );
}
