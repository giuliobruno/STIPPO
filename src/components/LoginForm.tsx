"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
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
      <div>
        <label className="vm-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="vm-input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="vm-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="vm-input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
