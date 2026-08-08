import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { reset?: string };
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="vm-brand-mark mb-8 text-2xl">
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight">Welcome back</h1>
      <p className="mt-2 mb-8 text-sm leading-relaxed text-[var(--ink-muted)]">
        Sign in to your work vault.
      </p>
      <LoginForm resetOk={searchParams?.reset === "1"} />
    </div>
  );
}
