"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset password");
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 text-sm text-[var(--ink-muted)]">
        <p>This reset link is missing a token. Request a new one from the forgot password page.</p>
        <Link href="/forgot-password" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Forgot password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <PasswordInput
        id="new-password"
        label="New password"
        value={password}
        onValueChange={setPassword}
        minLength={8}
        required
        autoComplete="new-password"
      />
      <PasswordInput
        id="confirm-password"
        label="Confirm password"
        value={confirm}
        onValueChange={setConfirm}
        minLength={8}
        required
        autoComplete="new-password"
      />
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="vm-btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        <Link href="/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
