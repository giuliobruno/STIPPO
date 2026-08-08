import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="vm-brand-mark mb-8 text-2xl">
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight">Set new password</h1>
      <p className="mt-2 mb-8 text-sm text-[var(--ink-muted)]">
        Choose a new password (at least 8 characters). Use the eye icon to verify what you type.
      </p>
      <ResetPasswordForm token={token} />
    </div>
  );
}
