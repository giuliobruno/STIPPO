"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Could not create account");
      return;
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (login?.error) {
      setError("Account created — please sign in");
      router.push("/login");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-4">
      <div>
        <label className="vm-label" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className="vm-input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
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
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button className="vm-btn-primary w-full" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-center text-xs text-[var(--ink-muted)]">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline-offset-2 hover:underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          Privacy
        </Link>
        , and{" "}
        <Link href="/disclaimer" className="underline-offset-2 hover:underline">
          Disclaimers
        </Link>
        .
      </p>
      <p className="text-center text-sm text-[var(--ink-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="text-[var(--accent)] underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
