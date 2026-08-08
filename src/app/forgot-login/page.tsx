import Link from "next/link";
import { ForgotLoginForm } from "@/components/ForgotLoginForm";

export default function ForgotLoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="vm-brand-mark mb-8 text-2xl">
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight">Forgot login</h1>
      <p className="mt-2 mb-8 text-sm text-[var(--ink-muted)]">
        Confirm which email is registered as your sign-in identity.
      </p>
      <ForgotLoginForm />
    </div>
  );
}
