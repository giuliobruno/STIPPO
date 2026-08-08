"use client";

import { useState } from "react";
import Link from "next/link";

export function CheckEmailPanel({
  email,
  inline = false,
  verifyUrl = "",
  sendFailed = false,
}: {
  email: string;
  inline?: boolean;
  verifyUrl?: string;
  sendFailed?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(
    sendFailed
      ? "The confirmation email did not leave our mail provider. Check RESEND_API_KEY / EMAIL_FROM on Vercel, then resend."
      : null
  );
  const [error, setError] = useState<string | null>(null);
  const [inlineLink, setInlineLink] = useState(inline ? verifyUrl : "");

  async function resend() {
    if (!email) {
      setError("Missing email address.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend email");
        return;
      }
      if (data.inline && data.verifyUrl) {
        setInlineLink(data.verifyUrl);
        setMessage(data.message || "Use the verification link below.");
      } else {
        setMessage(data.message || "If needed, a new confirmation email was sent.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper-2)] p-4 text-sm text-[var(--ink)]">
        {email ? (
          <p>
            We sent a confirmation link to <strong>{email}</strong>.
          </p>
        ) : (
          <p>We sent a confirmation link to your email address.</p>
        )}
        <p className="mt-2 text-[var(--ink-muted)]">
          Tip: add <code className="text-xs">noreply@stippo.app</code> (or your Resend
          from-address) to contacts so future mail stays out of spam.
        </p>
      </div>

      {inlineLink ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm">
          <p className="mb-2 text-[var(--ink-muted)]">Dev / inline verification link:</p>
          <a
            href={inlineLink}
            className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {inlineLink}
          </a>
        </div>
      ) : null}

      {message ? <p className="text-sm text-[var(--ink)]">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <button
        type="button"
        className="vm-btn-secondary w-full"
        disabled={busy || !email}
        onClick={() => void resend()}
      >
        {busy ? "Sending…" : "Resend confirmation email"}
      </button>

      <Link href="/login" className="vm-btn-primary w-full text-center">
        Back to sign in
      </Link>
    </div>
  );
}
