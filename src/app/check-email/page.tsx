import Link from "next/link";
import { CheckEmailPanel } from "@/components/CheckEmailPanel";

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams?: { email?: string; inline?: string; verifyUrl?: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]"
      >
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl">Check your email</h1>
      <p className="mt-2 mb-8 text-sm text-[var(--ink-muted)]">
        Confirm your address to activate your work vault. Check spam/promotions if you
        don’t see it within a minute.
      </p>
      <CheckEmailPanel
        email={searchParams?.email || ""}
        inline={searchParams?.inline === "1"}
        verifyUrl={searchParams?.verifyUrl || ""}
      />
    </div>
  );
}
