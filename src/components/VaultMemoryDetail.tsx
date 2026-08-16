"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, Link2, Trash2 } from "lucide-react";
import {
  deleteVaultMemory,
  getVaultMemory,
  initVault,
  updateVaultMemory,
} from "@/lib/vault";
import type { VaultMemory } from "@/lib/vault/types";
import { processSyncQueue } from "@/lib/vault/sync";
import { hostnameFromUrl, normalizeHttpUrl } from "@/lib/media/url";
import { formatBytes } from "@/lib/media/files";
import { usefulTags } from "@/lib/media/tags";

export function VaultMemoryDetail({ id }: { id: string }) {
  const router = useRouter();
  const [memory, setMemory] = useState<VaultMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [urlError, setUrlError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRef = useRef<VaultMemory | null>(null);
  memoryRef.current = memory;

  useEffect(() => {
    void initVault()
      .then(() => getVaultMemory(id))
      .then((m) => {
        if (!m) setError("Memory not found in local vault.");
        else {
          setMemory(m);
          setTitle(m.title);
          setDescription(m.description ?? "");
          setSourceUrl(m.sourceUrl ?? "");
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, [id]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function persist(
    patch: Partial<Pick<VaultMemory, "title" | "description" | "sourceUrl">>
  ) {
    const current = memoryRef.current;
    if (!current) return;

    const nextTitle = patch.title !== undefined ? patch.title : current.title;
    const nextDescription =
      patch.description !== undefined ? patch.description : current.description;
    const nextSourceUrl =
      patch.sourceUrl !== undefined ? patch.sourceUrl : current.sourceUrl;

    const sameTitle = nextTitle === current.title;
    const sameDescription = (nextDescription ?? null) === (current.description ?? null);
    const sameUrl = (nextSourceUrl ?? null) === (current.sourceUrl ?? null);
    if (sameTitle && sameDescription && sameUrl) return;

    setSaveState("saving");
    try {
      const updated = await updateVaultMemory(current.id, {
        title: nextTitle,
        description: nextDescription,
        sourceUrl: nextSourceUrl,
      });
      setMemory(updated);
      setTitle(updated.title);
      setDescription(updated.description ?? "");
      setSourceUrl(updated.sourceUrl ?? "");
      setSaveState("saved");
      void processSyncQueue().catch(() => undefined);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setSaveState("idle"), 1600);
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function onTitleBlur() {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(memory?.title ?? "");
      return;
    }
    void persist({ title: trimmed });
  }

  function onDescriptionBlur() {
    void persist({ description: description.trim() || null });
  }

  function onSourceUrlBlur() {
    const raw = sourceUrl.trim();
    if (!raw) {
      setUrlError(null);
      void persist({ sourceUrl: null });
      return;
    }
    const normalized = normalizeHttpUrl(raw);
    if (!normalized) {
      setUrlError("Enter a valid http(s) URL");
      setSourceUrl(memory?.sourceUrl ?? "");
      return;
    }
    setUrlError(null);
    setSourceUrl(normalized);
    void persist({ sourceUrl: normalized });
  }

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
  const host = hostnameFromUrl(sourceUrl || memory.sourceUrl);
  const showLinkEditor =
    memory.mediaType === "link" || Boolean(memory.sourceUrl) || Boolean(sourceUrl);
  const openableUrl = normalizeHttpUrl(sourceUrl) || memory.sourceUrl;
  const tags = usefulTags(memory.tags, { sourceUrl: memory.sourceUrl });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/app" className="vm-btn-ghost !px-0">
          <ArrowLeft className="h-4 w-4" /> Feed
        </Link>
        <div className="flex items-center gap-3">
          {saveState === "saving" ? (
            <span className="text-[11px] text-[var(--ink-muted)]">Saving…</span>
          ) : saveState === "saved" ? (
            <span className="text-[11px] text-[var(--accent)]">Saved</span>
          ) : saveState === "error" ? (
            <span className="text-[11px] text-[var(--danger)]">Save failed</span>
          ) : null}
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
        <div className="vm-media-frame flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 bg-[linear-gradient(155deg,var(--paper)_0%,var(--accent-soft)_55%,var(--paper-2)_100%)] px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--accent)] shadow-sm">
            <Link2 className="h-6 w-6" />
          </span>
          <p className="font-[family-name:var(--font-serif)] text-2xl tracking-tight">
            {host || "Link"}
          </p>
        </div>
      ) : null}

      {showLinkEditor ? (
        <div className="space-y-2 rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <p className="vm-label mb-0">Web address</p>
            {openableUrl ? (
              <a
                href={openableUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            ) : null}
          </div>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => {
              setSourceUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            onBlur={onSourceUrlBlur}
            aria-label="Web address"
            placeholder="https://…"
            className="w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-white px-3 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          />
          {urlError ? (
            <p className="text-xs text-[var(--danger)]">{urlError}</p>
          ) : (
            <p className="text-[11px] text-[var(--ink-muted)]">
              Tap the address to edit it
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ink-muted)]">
          {memory.mediaType} · {memory.syncState} · {memory.source}
        </p>
        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={onTitleBlur}
          rows={1}
          aria-label="Title"
          placeholder="Title"
          className="vm-page-title w-full resize-none border-0 bg-transparent p-0 leading-tight outline-none ring-0 placeholder:text-[var(--ink-muted)] focus:ring-0"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }
          }}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={onDescriptionBlur}
          rows={2}
          aria-label="Description"
          placeholder="Add a note or description…"
          className="w-full resize-y border-0 bg-transparent p-0 leading-relaxed text-[var(--ink-muted)] outline-none ring-0 placeholder:text-[var(--ink-muted)]/60 focus:ring-0"
        />
        {memory.aiSummary ? (
          <p className="text-sm leading-relaxed text-[var(--ink)]">{memory.aiSummary}</p>
        ) : null}
      </div>

      {tags.length ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
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
      {error && memory ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
