"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  initVault,
  listVaultProjects,
  upsertVaultProject,
} from "@/lib/vault";
import type { VaultProject } from "@/lib/vault/types";

export function VaultProjects() {
  const [projects, setProjects] = useState<VaultProject[]>([]);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    await initVault();
    setProjects(await listVaultProjects());
  }

  useEffect(() => {
    void reload();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await upsertVaultProject({
        name: name.trim(),
        description: null,
        location: location.trim() || null,
        clientName: clientName.trim() || null,
      });
      // Best-effort mirror to server for billing/legacy
      void fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || undefined,
          clientName: clientName.trim() || undefined,
        }),
      }).catch(() => undefined);
      setName("");
      setLocation("");
      setClientName("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">Projects</h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Studio units stored in your work vault — not generic folders.
        </p>
      </div>

      <form onSubmit={onCreate} className="vm-card space-y-3 p-5">
        <p className="vm-label mb-0">New project</p>
        <input
          className="vm-input"
          placeholder="Name (e.g. Hotel Milano)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="vm-input"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <input
            className="vm-input"
            placeholder="Client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : null}
        <button type="submit" className="vm-btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Create project"}
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/app?projectId=${p.id}`}
            className="vm-card block p-5 hover:border-[var(--accent)]/30"
          >
            <h3 className="font-[family-name:var(--font-serif)] text-xl">{p.name}</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              {[p.location, p.clientName].filter(Boolean).join(" · ") || "No location yet"}
            </p>
          </Link>
        ))}
        {projects.length === 0 ? (
          <p className="text-sm text-[var(--ink-muted)]">No projects yet.</p>
        ) : null}
      </div>
    </div>
  );
}
