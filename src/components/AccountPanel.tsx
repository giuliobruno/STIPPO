"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Download,
  ExternalLink,
  FileText,
  Scale,
  Shield,
  Trash2,
} from "lucide-react";

type Account = {
  id: string;
  name: string | null;
  email: string;
  plan: string;
  memoryCount: number;
  stripeStatus: string | null;
  createdAt: string;
  hasPassword: boolean;
};

export function AccountPanel() {
  const { update } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2 | 3>(0);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteTyped, setDeleteTyped] = useState("");

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setAccount(d);
        setName(d.name || "");
      })
      .catch(() => setError("Could not load account."));
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not update profile.");
      return;
    }
    setAccount((prev) => (prev ? { ...prev, name: data.user.name } : prev));
    await update();
    setMessage("Profile updated.");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password changed.");
  }

  async function exportData() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Export failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visual-memory-export-${account?.id || "data"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch {
      setError("Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!account) return;
    if (deleteTyped !== "DELETE") {
      setError('Type DELETE exactly to confirm.');
      return;
    }
    if (deleteEmail.toLowerCase() !== account.email.toLowerCase()) {
      setError("Email confirmation does not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmation: "DELETE",
        email: deleteEmail,
        password: account.hasPassword ? deletePassword : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Account deletion failed.");
      return;
    }
    await signOut({ callbackUrl: "/?deleted=1" });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">Account</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Credentials, subscription, privacy, and data controls.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--ok)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      {/* Profile */}
      <section className="vm-card space-y-4 p-6">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">Profile</h3>
        {!account ? (
          <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
        ) : (
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="vm-label" htmlFor="account-name">
                Display name
              </label>
              <input
                id="account-name"
                className="vm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="vm-label" htmlFor="account-email">
                Email
              </label>
              <input
                id="account-email"
                className="vm-input bg-[var(--paper-2)]"
                value={account.email}
                disabled
                readOnly
              />
              <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                Email is your sign-in identity and cannot be changed here.
              </p>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Member since {new Date(account.createdAt).toLocaleDateString()} ·{" "}
              {account.memoryCount} memor{account.memoryCount === 1 ? "y" : "ies"} ·{" "}
              <span className="capitalize">{account.plan}</span> plan
            </p>
            <button type="submit" className="vm-btn-primary" disabled={busy}>
              Save profile
            </button>
          </form>
        )}
      </section>

      {/* Password */}
      {account?.hasPassword ? (
        <section className="vm-card space-y-4 p-6">
          <h3 className="font-[family-name:var(--font-serif)] text-xl">Password</h3>
          <form onSubmit={changePassword} className="space-y-3">
            <div>
              <label className="vm-label" htmlFor="current-password">
                Current password
              </label>
              <input
                id="current-password"
                type="password"
                className="vm-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="vm-label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className="vm-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="vm-label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                className="vm-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="vm-btn-secondary" disabled={busy}>
              Update password
            </button>
          </form>
        </section>
      ) : null}

      {/* Subscription */}
      <section className="vm-card space-y-3 p-6">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">Subscription</h3>
        <p className="text-sm text-[var(--ink-muted)]">
          Manage your plan, invoices, and payment method via Billing.
        </p>
        <Link href="/app/billing" className="vm-btn-secondary inline-flex">
          Open billing
          <ExternalLink className="h-4 w-4" />
        </Link>
      </section>

      {/* Privacy & legal */}
      <section className="vm-card space-y-4 p-6">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">Privacy & legal</h3>
        <p className="text-sm text-[var(--ink-muted)]">
          Visual Memory is built local-first: full-resolution originals stay on your
          device by default. The service holds a minimal semantic index so search
          works across devices — not a copy of your project archive.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <LegalChip href="/privacy" icon={Shield} label="Privacy" />
          <LegalChip href="/terms" icon={FileText} label="Terms of use" />
          <LegalChip href="/disclaimer" icon={Scale} label="Disclaimers" />
        </div>
      </section>

      {/* Data export */}
      <section className="vm-card space-y-3 p-6">
        <h3 className="font-[family-name:var(--font-serif)] text-xl">Your data</h3>
        <p className="text-sm text-[var(--ink-muted)]">
          Download a machine-readable export of your account, projects, and memory
          metadata (GDPR portability).
        </p>
        <button
          type="button"
          className="vm-btn-secondary"
          disabled={busy || !account}
          onClick={() => void exportData()}
        >
          <Download className="h-4 w-4" />
          Export JSON
        </button>
      </section>

      {/* Danger zone — 3-step delete */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />
          <div>
            <h3 className="font-[family-name:var(--font-serif)] text-xl text-[var(--danger)]">
              Delete account
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Permanently erase your account, all memories, projects, media files,
              and cancel any active subscription. This cannot be undone.
            </p>
          </div>
        </div>

        {deleteStep === 0 ? (
          <button
            type="button"
            className="vm-btn border border-red-300 bg-white text-[var(--danger)] hover:bg-red-50"
            onClick={() => {
              setError(null);
              setDeleteStep(1);
            }}
          >
            Start account deletion…
          </button>
        ) : null}

        {deleteStep === 1 ? (
          <DeleteStep
            level={1}
            title="Are you sure you want to delete your account?"
            body="You will lose access immediately. All project references and AI indexes tied to this account will be removed."
            onCancel={() => setDeleteStep(0)}
            onContinue={() => setDeleteStep(2)}
          />
        ) : null}

        {deleteStep === 2 ? (
          <DeleteStep
            level={2}
            title="Are you absolutely sure?"
            body="This second confirmation is intentional. Deletion is irreversible. Backups for recovery will not be retained for closed accounts."
            onCancel={() => setDeleteStep(0)}
            onContinue={() => setDeleteStep(3)}
          />
        ) : null}

        {deleteStep === 3 ? (
          <div className="space-y-4 rounded-xl border border-red-300 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--danger)]">
              Confirmation 3 of 3
            </p>
            <p className="font-medium text-[var(--ink)]">
              Final check — do you really want to erase everything?
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Type your email, your password{account?.hasPassword ? "" : " (if any)"}, and
              the word <strong>DELETE</strong> to proceed.
            </p>
            <div>
              <label className="vm-label" htmlFor="delete-email">
                Your email
              </label>
              <input
                id="delete-email"
                className="vm-input"
                type="email"
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                placeholder={account?.email}
                autoComplete="off"
              />
            </div>
            {account?.hasPassword ? (
              <div>
                <label className="vm-label" htmlFor="delete-password">
                  Password
                </label>
                <input
                  id="delete-password"
                  className="vm-input"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            ) : null}
            <div>
              <label className="vm-label" htmlFor="delete-typed">
                Type DELETE
              </label>
              <input
                id="delete-typed"
                className="vm-input"
                value={deleteTyped}
                onChange={(e) => setDeleteTyped(e.target.value)}
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="vm-btn-ghost"
                onClick={() => {
                  setDeleteStep(0);
                  setDeleteEmail("");
                  setDeletePassword("");
                  setDeleteTyped("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="vm-btn bg-[var(--danger)] text-white hover:bg-[#6f2e2e]"
                disabled={busy}
                onClick={() => void confirmDelete()}
              >
                {busy ? "Deleting…" : "Yes — delete my account forever"}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LegalChip({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Shield;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-3 text-sm transition hover:bg-[var(--paper-2)]"
    >
      <Icon className="h-4 w-4 text-[var(--accent)]" />
      {label}
    </Link>
  );
}

function DeleteStep({
  level,
  title,
  body,
  onCancel,
  onContinue,
}: {
  level: number;
  title: string;
  body: string;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-red-300 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--danger)]">
        Confirmation {level} of 3
      </p>
      <p className="font-medium text-[var(--ink)]">{title}</p>
      <p className="text-sm text-[var(--ink-muted)]">{body}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="vm-btn-ghost" onClick={onCancel}>
          No, keep my account
        </button>
        <button
          type="button"
          className="vm-btn border border-red-300 bg-white text-[var(--danger)] hover:bg-red-50"
          onClick={onContinue}
        >
          Yes, I am sure — continue
        </button>
      </div>
    </div>
  );
}
