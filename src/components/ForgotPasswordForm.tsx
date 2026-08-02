"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    setResetUrl(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not start password reset");
        return;
      }
      setMessage(data.message || "Check the next step below.");
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <p className="text-sm text-[var(--ink-muted)]">
        Passwords are stored as one-way hashes — they cannot be revealed. Enter your
        account email to replace the password with a new one.
      </p>
      <div>
        <label className="vm-label" htmlFor="forgot-email">
          Email
        </label>
        <input
          id="forgot-email"
          className="vm-input"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--ink)]">{message}</p> : null}
      {resetUrl ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
            One-time reset link
          </p>
          <Link
            href={resetUrl}
            className="block break-all text-sm text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {resetUrl}
          </Link>
        </div>
      ) : null}
      <button className="vm-btn-primary w-full" disabled={busy}>
        {busy ? "Working…" : "Reset password"}
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        <Link href="/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
