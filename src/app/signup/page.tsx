import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link href="/" className="vm-brand-mark mb-8 text-2xl">
        Stippo
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl tracking-tight">
        Create your vault
      </h1>
      <p className="mt-2 mb-8 text-sm leading-relaxed text-[var(--ink-muted)]">
        Free plan includes 100 memories. A sample Milan Hotel project is ready on signup.
      </p>
      <SignupForm />
    </div>
  );
}
