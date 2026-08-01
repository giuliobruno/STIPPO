"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = {
  plan: string;
  pro: boolean;
  memoryCount: number;
  memoryLimit: number | null;
  stripeConfigured: boolean;
  stripeStatus?: string | null;
};

export function BillingPanel() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("Could not load billing status"));
  }, []);

  async function checkout() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Checkout failed");
      return;
    }
    if (data.url) window.location.href = data.url;
  }

  async function portal() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Portal failed");
      return;
    }
    if (data.url) window.location.href = data.url;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">Billing</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Free: 100 memories. Pro ($15/mo): unlimited + full-res sync opt-in. Manage
          credentials and data deletion from{" "}
          <Link href="/app/account" className="text-[var(--accent)] underline-offset-2 hover:underline">
            Account
          </Link>
          .
        </p>
      </div>

      {params.get("success") ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-[var(--ok)]">
          Subscription updated. Welcome to Pro.
        </p>
      ) : null}
      {params.get("canceled") ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink-muted)]">
          Checkout canceled.
        </p>
      ) : null}

      <div className="vm-card space-y-4 p-6">
        {status ? (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-[var(--ink-muted)]">Current plan</p>
              <p className="font-[family-name:var(--font-serif)] text-2xl capitalize">
                {status.plan}
              </p>
            </div>
            <p className="text-sm text-[var(--ink-muted)]">
              Memories: {status.memoryCount}
              {status.memoryLimit != null ? ` / ${status.memoryLimit}` : " · unlimited"}
            </p>
            {status.stripeStatus ? (
              <p className="text-xs text-[var(--ink-muted)]">
                Stripe status: {status.stripeStatus}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--ink-muted)]">Loading…</p>
        )}

        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {!status?.pro ? (
            <button
              type="button"
              className="vm-btn-primary"
              disabled={busy || status?.stripeConfigured === false}
              onClick={() => void checkout()}
            >
              {busy ? "…" : "Upgrade to Pro — $15/mo"}
            </button>
          ) : (
            <button
              type="button"
              className="vm-btn-secondary"
              disabled={busy}
              onClick={() => void portal()}
            >
              Manage subscription
            </button>
          )}
        </div>

        {status && !status.stripeConfigured ? (
          <p className="text-xs text-[var(--ink-muted)]">
            Stripe keys not set. Add STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, and
            STRIPE_WEBHOOK_SECRET to enable checkout.
          </p>
        ) : null}
      </div>

      <div className="vm-card space-y-2 p-5 text-sm text-[var(--ink-muted)]">
        <p className="font-medium text-[var(--ink)]">Hybrid Plan B</p>
        <p>
          All plans sync <strong>understanding + thumbnails</strong> so you can find
          memories on any device. Pro can optionally sync full-resolution originals.
        </p>
      </div>
    </div>
  );
}
