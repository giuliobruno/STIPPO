"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Cloud,
} from "lucide-react";
import { getVaultMeta, initVault } from "@/lib/vault";
import {
  connectCloud,
  disconnectCloud,
  processSyncQueue,
  pullVaultIndex,
} from "@/lib/vault/sync";
import type { VaultMeta } from "@/lib/vault/types";

/**
 * Vault setup — local folder first.
 * Cloud sync = user's Drive/Dropbox/OneDrive desktop client watching that folder.
 * No OAuth app keys required for the architect.
 */
export function VaultSetupPanel() {
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderSupported, setFolderSupported] = useState(true);

  useEffect(() => {
    void initVault().then(() => getVaultMeta().then(setMeta));
    setFolderSupported(
      typeof window !== "undefined" && "showDirectoryPicker" in window
    );
  }, []);

  const connected =
    meta?.cloudProvider && meta.cloudProvider !== "none"
      ? meta
      : null;

  async function chooseFolder() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const location = await connectCloud("local_folder");
      setMeta(await getVaultMeta());
      setMessage(
        `Vault folder: ${location.displayPath}. Put this folder inside Google Drive, Dropbox, or OneDrive so it syncs live.`
      );
      await processSyncQueue().catch(() => undefined);
      setMeta(await getVaultMeta());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open folder");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    try {
      const result = await processSyncQueue();
      setMeta(await getVaultMeta());
      setMessage(
        result.processed
          ? `Wrote ${result.processed} file(s) to your vault folder.`
          : result.errors[0] || "Vault folder is up to date."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function pullNow() {
    setBusy(true);
    setError(null);
    try {
      const { imported } = await pullVaultIndex();
      setMeta(await getVaultMeta());
      setMessage(
        imported
          ? `Imported ${imported} memories from the vault folder.`
          : "No vault-index.json found yet — capture something first, then Sync."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectCloud();
      setMeta(await getVaultMeta());
      setMessage("Folder disconnected. Captures stay in this browser until you choose a folder again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">
          Work vault
        </h2>
        <p className="text-sm text-[var(--ink-muted)]">
          Choose a folder on <strong>your</strong> computer. Stippo writes project
          photos there. Your cloud client (Drive, Dropbox, OneDrive) keeps it in sync —
          no developer keys, no Stippo cloud storage.
        </p>
      </div>

      {connected ? (
        <div className="vm-card space-y-4 p-5">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Vault folder connected</p>
          </div>
          <p className="text-sm text-[var(--ink)]">
            {connected.cloudFolderName || "Local folder"}
          </p>
          {connected.lastSyncAt ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Last write {new Date(connected.lastSyncAt).toLocaleString()}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="vm-btn-primary"
              disabled={busy}
              onClick={() => void syncNow()}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync now
            </button>
            <button
              type="button"
              className="vm-btn-secondary"
              disabled={busy}
              onClick={() => void pullNow()}
            >
              Pull from folder
            </button>
            <button
              type="button"
              className="vm-btn-secondary"
              disabled={busy}
              onClick={() => void chooseFolder()}
            >
              Change folder
            </button>
            <button
              type="button"
              className="vm-btn-ghost"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="vm-card space-y-4 p-5">
          {!folderSupported ? (
            <p className="text-sm text-[var(--danger)]">
              Folder picker needs Chrome or Edge on desktop. On phone, captures stay
              in the app until you open Stippo on a desktop and choose a folder.
            </p>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              Tip: create a folder named <strong>Stippo</strong> inside your Google Drive,
              Dropbox, or OneDrive folder on this PC, then select it below.
            </p>
          )}
          <button
            type="button"
            className="vm-btn-primary w-full !py-3.5"
            disabled={busy || !folderSupported}
            onClick={() => void chooseFolder()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            Choose vault folder
          </button>
        </div>
      )}

      {message ? (
        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="vm-card space-y-4 p-5 text-sm text-[var(--ink-muted)]">
        <div className="flex items-center gap-2 text-[var(--ink)]">
          <Cloud className="h-4 w-4 text-[var(--accent)]" />
          <p className="font-medium">How live cloud sync works</p>
        </div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Install the desktop app for your cloud if needed (Google Drive for desktop,
            Dropbox, OneDrive).
          </li>
          <li>
            Create a folder <code className="text-xs">Stippo</code> inside that cloud
            directory on this computer.
          </li>
          <li>
            In Stippo, click <strong>Choose vault folder</strong> and select that folder.
          </li>
          <li>
            Capture as usual. Stippo writes files locally; your cloud app uploads them
            in the background.
          </li>
          <li>
            On another PC: install the same cloud app → wait for <code className="text-xs">Stippo</code> to
            appear → open Stippo → choose the same folder → <strong>Pull</strong>.
          </li>
        </ol>
        <p className="text-xs">
          No API keys. No Stippo account on Google/Dropbox. Your cloud, your files.
        </p>
      </div>
    </div>
  );
}
