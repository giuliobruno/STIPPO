"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

export function ForgotLoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tips, setTips] = useState<string[]>([]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setTips([]);
    try {
      const res = await fetch("/api/auth/forgot-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not look up login");
        return;
      }
      setMessage(data.message || null);
      setTips(Array.isArray(data.tips) ? data.tips : []);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <p className="text-sm text-[var(--ink-muted)]">
        Your login is the <strong>email address</strong> you used to register. Enter it
        below for sign-in options — we never confirm whether an address is registered.
      </p>
      <div>
        <label className="vm-label" htmlFor="lookup-email">
          Email
        </label>
        <input
          id="lookup-email"
          className="vm-input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-3 text-sm text-[var(--ink)]">
          <p>{message}</p>
          {tips.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ink-muted)]">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button className="vm-btn-primary w-full" disabled={busy}>
        {busy ? "Checking…" : "Show sign-in options"}
      </button>
      {message ? (
        <div className="flex flex-col gap-2">
          <Link href="/login" className="vm-btn-secondary w-full text-center">
            Go to sign in
          </Link>
          <Link href="/forgot-password" className="vm-btn-ghost w-full text-center">
            Forgot password?
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        className="vm-btn-secondary w-full"
        onClick={() => signIn("google", { callbackUrl: "/app" })}
      >
        Continue with Google
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        <Link href="/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Back to sign in
        </Link>
        {" · "}
        <Link href="/signup" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Create account
        </Link>
      </p>
    </form>
  );
}
