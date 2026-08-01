import Link from "next/link";
import { SignupForm } from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Link
        href="/"
        className="mb-8 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]"
      >
        Visual Memory
      </Link>
      <h1 className="font-[family-name:var(--font-serif)] text-4xl">Create your memory</h1>
      <p className="mt-2 mb-8 text-sm text-[var(--ink-muted)]">
        Free plan includes 100 memories. A sample Milan Hotel project is ready on signup.
      </p>
      <SignupForm />
    </div>
  );
}
