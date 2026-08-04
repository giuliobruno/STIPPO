"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  FolderOpen,
  HardDrive,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { getVaultMeta, initVault } from "@/lib/vault";
import {
  connectCloud,
  disconnectCloud,
  processSyncQueue,
  pullVaultIndex,
} from "@/lib/vault/sync";
import type { CloudProviderId, VaultMeta } from "@/lib/vault/types";

const providers: Array<{
  id: CloudProviderId;
  title: string;
  body: string;
  icon: typeof Cloud;
}> = [
  {
    id: "google_drive",
    title: "Google Drive",
    body: "Best for phone + laptop. Creates a Stippo folder; sync is automatic.",
    icon: Cloud,
  },
  {
    id: "local_folder",
    title: "Local sync folder",
    body: "Desktop: pick a folder already synced by Drive Desktop / OneDrive.",
    icon: FolderOpen,
  },
  {
    id: "onedrive",
    title: "OneDrive",
    body: "Microsoft 365 studios — scaffolded; enable with MSAL client id.",
    icon: HardDrive,
  },
];

export function VaultSetupPanel() {
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void initVault().then(() => getVaultMeta().then(setMeta));
  }, []);

  async function connect(provider: CloudProviderId) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const location = await connectCloud(provider);
      setMeta(await getVaultMeta());
      setMessage(`Connected: ${location.displayPath}`);
      const pulled = await pullVaultIndex().catch(() => ({ imported: 0 }));
      if (pulled.imported) {
        setMessage(`Connected · imported ${pulled.imported} memories`);
      }
      await processSyncQueue();
      setMeta(await getVaultMeta());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectCloud();
      setMeta(await getVaultMeta());
      setMessage("Cloud disconnected. Local vault remains on this device.");
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
          Your project archive lives on <strong>your</strong> cloud — separate from
          personal photos. Stippo never hosts the full-res files.
        </p>
      </div>

      {meta?.cloudProvider && meta.cloudProvider !== "none" ? (
        <div className="vm-card space-y-3 p-5">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">Connected</p>
          </div>
          <p className="text-sm text-[var(--ink)]">
            {meta.cloudFolderName || meta.cloudProvider}
          </p>
          {meta.lastSyncAt ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Last sync {new Date(meta.lastSyncAt).toLocaleString()}
            </p>
          ) : null}
          <button
            type="button"
            className="vm-btn-secondary"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(({ id, title, body, icon: Icon }) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => void connect(id)}
              className="vm-card flex w-full items-start gap-4 p-5 text-left transition hover:border-[var(--accent)]"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
              <div>
                <p className="font-medium text-[var(--ink)]">{title}</p>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{body}</p>
              </div>
              {busy ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : null}
            </button>
          ))}
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

      <div className="vm-card space-y-2 p-5 text-sm text-[var(--ink-muted)]">
        <p className="font-medium text-[var(--ink)]">How it works</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Capture with the in-app camera (work only).</li>
          <li>AI tags the image on ingest — searchable without spoken keywords.</li>
          <li>Files sync to <code className="text-xs">Stippo/</code> on your cloud.</li>
          <li>Another device → connect the same cloud → Pull.</li>
        </ol>
      </div>
    </div>
  );
}
