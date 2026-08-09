"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { MemoryCard } from "@/components/MemoryCard";
import {
  initVault,
  listVaultMemories,
  getVaultMeta,
} from "@/lib/vault";
import { processSyncQueue, pullVaultIndex } from "@/lib/vault/sync";
import type { VaultMemory, VaultMeta } from "@/lib/vault/types";
import { fill, useLocale, useT } from "@/i18n";

export function VaultFeed({ projectId }: { projectId?: string }) {
  const t = useT();
  const { locale } = useLocale();
  const f = t.feed;
  const [memories, setMemories] = useState<VaultMemory[]>([]);
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await initVault();
    const [rows, m] = await Promise.all([
      listVaultMemories({ projectId, limit: 60 }),
      getVaultMeta(),
    ]);
    setMemories(rows);
    setMeta(m);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function syncNow() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await processSyncQueue();
      setMessage(
        result.processed
          ? fill(f.syncedItems, { count: result.processed })
          : result.errors[0] || f.nothingToSync
      );
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : f.syncFailed);
    } finally {
      setBusy(false);
    }
  }

  async function pullRemote() {
    setBusy(true);
    setMessage(null);
    try {
      const { imported } = await pullVaultIndex();
      setMessage(
        imported ? fill(f.imported, { count: imported }) : f.noRemote
      );
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : f.pullFailed);
    } finally {
      setBusy(false);
    }
  }

  const cloudLabel =
    meta?.cloudProvider && meta.cloudProvider !== "none"
      ? meta.cloudFolderName || meta.cloudProvider
      : null;

  const subtitle = fill(
    memories.length === 1 ? f.subtitleOne : f.subtitleMany,
    { count: memories.length }
  );

  return (
    <div className="vm-section">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="vm-page-title">{f.title}</h2>
          <p className="vm-page-sub">{subtitle}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-muted)]">
            {cloudLabel ? (
              <span className="inline-flex max-w-full items-start gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[var(--accent)]">
                <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 break-all font-mono text-[11px]">
                  {meta?.cloudFolderPath || cloudLabel}
                  {meta?.lastSyncAt
                    ? fill(f.syncedAt, {
                        when: new Date(meta.lastSyncAt).toLocaleString(locale),
                      })
                    : ""}
                </span>
              </span>
            ) : (
              <Link
                href="/app/vault"
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--accent)]/40 bg-[var(--accent-soft)]/60 px-2.5 py-1 font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
              >
                <CloudOff className="h-3.5 w-3.5" />
                {f.chooseFolder}
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
            {f.sync}
          </button>
          <button
            type="button"
            className="vm-btn-secondary"
            disabled={busy}
            onClick={() => void pullRemote()}
          >
            {f.pull}
          </button>
          <Link href="/app/capture" className="vm-btn-primary hidden sm:inline-flex">
            {f.capture}
          </Link>
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--ink-muted)]">
          {message}
        </p>
      ) : null}

      {memories.length === 0 ? (
        <div className="vm-empty">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-serif)] text-2xl tracking-tight">
              {f.emptyTitle}
            </h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--ink-muted)]">
              {f.emptyBody}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/capture" className="vm-btn-primary">
              {f.openCapture}
            </Link>
            <Link href="/app/vault" className="vm-btn-secondary">
              {f.setUpVault}
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
                mediaType: m.mediaType,
                sourceUrl: m.sourceUrl,
                sourceTitle: m.sourceTitle,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
