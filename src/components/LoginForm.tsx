"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm({ resetOk = false }: { resetOk?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      {resetOk ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-[var(--ink)]">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      <div>
        <label className="vm-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="vm-input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <PasswordInput
        id="password"
        label="Password"
        value={password}
        onValueChange={setPassword}
        required
        autoComplete="current-password"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href="/forgot-password"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
        <Link
          href="/forgot-login"
          className="text-[var(--accent)] underline-offset-2 hover:underline"
        >
          Forgot login?
        </Link>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="vm-btn-primary w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <button
        type="button"
        className="vm-btn-secondary w-full"
        onClick={() => signIn("google", { callbackUrl: "/app" })}
      >
        Continue with Google
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        No account?{" "}
        <Link href="/signup" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
