"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
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
    <div className="vm-section">
      <div>
        <h2 className="vm-page-title">Projects</h2>
        <p className="vm-page-sub">
          Studio units stored in your work vault — not generic folders.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="space-y-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]"
      >
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

      {projects.length === 0 ? (
        <div className="vm-empty">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
              No projects yet
            </h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Create one above, or let Capture auto-detect from your voice note.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/app?projectId=${p.id}`}
              className="vm-card vm-card-interactive block p-5"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <FolderKanban className="h-4 w-4" />
              </div>
              <h3 className="font-[family-name:var(--font-serif)] text-xl tracking-tight">
                {p.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">
                {[p.location, p.clientName].filter(Boolean).join(" · ") || "No location yet"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
