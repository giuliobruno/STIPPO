"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function VerifyEmailClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(
    token ? "Confirming your email…" : "Missing confirmation token."
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Could not confirm this email.");
          return;
        }
        setStatus("ok");
        setMessage("Email confirmed. You can sign in now.");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Network error — try again from the link in your email.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 text-sm ${
          status === "ok"
            ? "border-emerald-200 bg-emerald-50/60 text-[var(--ink)]"
            : status === "error"
              ? "border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[var(--ink)]"
              : "border-[var(--line)] bg-[var(--paper-2)] text-[var(--ink-muted)]"
        }`}
      >
        {message}
      </div>
      {status === "ok" ? (
        <Link href="/login" className="vm-btn-primary w-full text-center">
          Sign in
        </Link>
      ) : null}
      {status === "error" ? (
        <Link href="/check-email" className="vm-btn-secondary w-full text-center">
          Request a new link
        </Link>
      ) : null}
    </div>
  );
}
