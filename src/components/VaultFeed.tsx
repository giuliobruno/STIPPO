"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { MemoryCard } from "@/components/MemoryCard";
import {
  initVault,
  listVaultMemories,
  getVaultMeta,
} from "@/lib/vault";
import { processSyncQueue, pullVaultIndex } from "@/lib/vault/sync";
import type { VaultMemory, VaultMeta } from "@/lib/vault/types";

export function VaultFeed({ projectId }: { projectId?: string }) {
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    await initVault();
    const [rows, m] = await Promise.all([
      listVaultMemories({ projectId, limit: 60 }),
      getVaultMeta(),
    ]);
    setMemories(rows);
    setMeta(m);
  }

  useEffect(() => {
    void reload();
  }, [projectId]);

  async function syncNow() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await processSyncQueue();
      setMessage(
        result.processed
          ? `Synced ${result.processed} item(s).`
          : result.errors[0] || "Nothing to sync."
      );
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function pullRemote() {
    setBusy(true);
    setMessage(null);
    try {
      const { imported } = await pullVaultIndex();
      setMessage(imported ? `Imported ${imported} memories from cloud.` : "No remote index found.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  const cloudLabel =
    meta?.cloudProvider && meta.cloudProvider !== "none"
      ? meta.cloudFolderName || meta.cloudProvider
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-serif)] text-3xl">
            Work vault
          </h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            {memories.length} reference{memories.length === 1 ? "" : "s"} · separate from personal photos
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
            {cloudLabel ? (
              <span className="inline-flex max-w-full items-start gap-1 text-[var(--accent)]">
                <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-all font-mono">
                  {meta?.cloudFolderPath || cloudLabel}
                  {meta?.lastSyncAt
                    ? ` · synced ${new Date(meta.lastSyncAt).toLocaleString()}`
                    : ""}
                </span>
              </span>
            ) : (
              <Link
                href="/app/vault"
                className="inline-flex items-center gap-1 text-[var(--accent)]"
              >
                <CloudOff className="h-3.5 w-3.5" />
                Choose vault folder
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="vm-btn-secondary"
            disabled={busy}
            onClick={() => void syncNow()}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Sync
          </button>
          <button
            type="button"
            className="vm-btn-secondary"
            disabled={busy}
            onClick={() => void pullRemote()}
          >
            Pull
          </button>
          <Link href="/app/capture" className="vm-btn-primary hidden sm:inline-flex">
            + Capture
          </Link>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink-muted)]">
          {message}
        </p>
      ) : null}

      {memories.length === 0 ? (
        <div className="vm-card flex flex-col items-start gap-4 p-8">
          <h3 className="font-[family-name:var(--font-serif)] text-2xl">
            Vault is empty
          </h3>
          <p className="max-w-md text-sm text-[var(--ink-muted)]">
            Use the in-app camera for project references. They stay out of your
            personal album and sync to the cloud folder you choose.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/capture" className="vm-btn-primary">
              Open Capture
            </Link>
            <Link href="/app/vault" className="vm-btn-secondary">
              Set up vault
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={{
                id: m.id,
                title: m.title,
                description: m.description,
                imageUrl: m.thumbBlobUrl || m.localBlobUrl || null,
                tags: m.tags,
                projectName: null,
                createdAt: m.createdAt,
                status: m.status,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
