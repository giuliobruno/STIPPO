"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Link2, Trash2 } from "lucide-react";
import {
  deleteVaultMemory,
  getVaultMemory,
  initVault,
} from "@/lib/vault";
import type { VaultMemory } from "@/lib/vault/types";
import { processSyncQueue } from "@/lib/vault/sync";
import { hostnameFromUrl } from "@/lib/media/url";
import { formatBytes } from "@/lib/media/files";

export function VaultMemoryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [memory, setMemory] = useState<VaultMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void initVault()
      .then(() => getVaultMemory(id))
      .then((m) => {
        if (!m) setError("Memory not found in local vault.");
        else setMemory(m);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this reference from your vault?")) return;
    setBusy(true);
    try {
      await deleteVaultMemory(id);
      void processSyncQueue().catch(() => undefined);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  if (error && !memory) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/app" className="vm-btn-ghost !px-0">
          <ArrowLeft className="h-4 w-4" /> Feed
        </Link>
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!memory) {
    return <p className="text-sm text-[var(--ink-muted)]">Loading…</p>;
  }

  const mediaUrl = memory.localBlobUrl || memory.thumbBlobUrl;
  const host = hostnameFromUrl(memory.sourceUrl);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/app" className="vm-btn-ghost !px-0">
          <ArrowLeft className="h-4 w-4" /> Feed
        </Link>
        <button
          type="button"
          className="vm-btn-secondary !text-[var(--danger)]"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {mediaUrl && memory.mediaType !== "document" ? (
        memory.mediaType === "video" ? (
          <video src={mediaUrl} controls className="vm-media-frame w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt={memory.title}
            className="vm-media-frame w-full object-cover"
          />
        )
      ) : memory.mediaType === "document" ? (
        <div className="vm-media-frame flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
            <FileText className="h-6 w-6" />
          </span>
          <p className="max-w-full truncate font-[family-name:var(--font-serif)] text-2xl tracking-tight">
            {memory.sourceTitle || memory.title}
          </p>
          <p className="text-sm text-[var(--ink-muted)]">
            {memory.mimeType || "file"}
            {memory.fileSize != null ? ` · ${formatBytes(memory.fileSize)}` : ""}
          </p>
          {mediaUrl ? (
            <a
              href={mediaUrl}
              download={memory.sourceTitle || "file"}
              className="vm-btn-secondary mt-1"
            >
              <Download className="h-4 w-4" />
              Open / download
            </a>
          ) : null}
        </div>
      ) : memory.mediaType === "link" ? (
        memory.sourceUrl ? (
          <a
            href={memory.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="vm-media-frame flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center transition hover:brightness-[0.98]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <Link2 className="h-6 w-6" />
            </span>
            <p className="font-[family-name:var(--font-serif)] text-2xl tracking-tight">
              {host || "Link"}
            </p>
          </a>
        ) : (
          <div className="vm-media-frame flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
              <Link2 className="h-6 w-6" />
            </span>
            <p className="font-[family-name:var(--font-serif)] text-2xl tracking-tight">
              {host || "Link"}
            </p>
          </div>
        )
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          {memory.mediaType} · {memory.syncState} · {memory.source}
        </p>
        <h2 className="vm-page-title">{memory.title}</h2>
        {memory.description ? (
          <p className="leading-relaxed text-[var(--ink-muted)]">{memory.description}</p>
        ) : null}
        {memory.aiSummary ? (
          <p className="text-sm leading-relaxed text-[var(--ink)]">{memory.aiSummary}</p>
        ) : null}
      </div>

      {memory.sourceUrl ? (
        <a
          href={memory.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] transition hover:border-[var(--accent)]/35"
        >
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <p className="vm-label mb-1">
              {memory.sourceTitle || host || "Source"}
            </p>
            <p className="break-all text-sm text-[var(--accent)]">
              {memory.sourceUrl}
            </p>
          </div>
        </a>
      ) : null}

      {memory.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {memory.tags.map((t) => (
            <span key={t} className="vm-chip">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {memory.transcript ? (
        <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="vm-label">Voice note</p>
          <p className="text-sm leading-relaxed">{memory.transcript}</p>
        </div>
      ) : null}

      {memory.ocrText ? (
        <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <p className="vm-label">OCR</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{memory.ocrText}</p>
        </div>
      ) : null}

      {memory.errorMessage ? (
        <p className="text-sm text-[var(--danger)]">{memory.errorMessage}</p>
      ) : null}
    </div>
  );
}
