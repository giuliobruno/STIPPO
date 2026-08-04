"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Cloud,
} from "lucide-react";
import { getVaultMeta, initVault, updateVaultMeta } from "@/lib/vault";
import {
  connectCloud,
  disconnectCloud,
  processSyncQueue,
  pullVaultIndex,
} from "@/lib/vault/sync";
import {
  getLocalFolderPath,
  setLocalFolderPath,
} from "@/lib/vault/adapters/local-folder";
import { dropboxOAuthPending } from "@/lib/vault/adapters/dropbox";
import type { CloudProviderId, VaultMeta } from "@/lib/vault/types";

export function VaultSetupPanel() {
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderSupported, setFolderSupported] = useState(true);
  const [pathDraft, setPathDraft] = useState("");

  const driveReady = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
  const dropboxReady = Boolean(process.env.NEXT_PUBLIC_DROPBOX_APP_KEY);

  useEffect(() => {
    setFolderSupported(
      typeof window !== "undefined" && "showDirectoryPicker" in window
    );

    void initVault().then(async () => {
      const m = await getVaultMeta();
      setMeta(m);
      setPathDraft(
        m.cloudFolderPath || getLocalFolderPath() || m.cloudFolderName || ""
      );

      if (dropboxOAuthPending()) {
        setBusy(true);
        try {
          await finishConnect("dropbox");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Dropbox non riuscito");
        } finally {
          setBusy(false);
        }
      }
    });
  }, []);

  const connected =
    meta?.cloudProvider && meta.cloudProvider !== "none" ? meta : null;

  async function finishConnect(provider: CloudProviderId) {
    const location = await connectCloud(provider);
    if (provider === "local_folder") {
      const folderName = location.folderName;
      const suggested =
        getLocalFolderPath() ||
        (folderName ? `C:\\Users\\TuoNome\\Google Drive\\${folderName}` : "");
      const entered = window.prompt(
        "Incolla qui il percorso completo della cartella.\n\nCome: Esplora file → clicca la barra degli indirizzi → Ctrl+C",
        suggested || folderName
      );
      const fullPath = (entered || "").trim() || folderName;
      setLocalFolderPath(fullPath);
      await updateVaultMeta({
        cloudFolderName: folderName,
        cloudFolderPath: fullPath,
      });
      setPathDraft(fullPath);
    }
    setMeta(await getVaultMeta());
    setMessage("Fatto. Le prossime foto andranno sul tuo cloud.");
    const pulled = await pullVaultIndex().catch(() => ({ imported: 0 }));
    if (pulled.imported) {
      setMessage(`Fatto. Recuperate ${pulled.imported} foto già presenti.`);
    }
    await processSyncQueue().catch(() => undefined);
    setMeta(await getVaultMeta());
  }

  async function connect(provider: CloudProviderId) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await finishConnect(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa non ha funzionato");
    } finally {
      setBusy(false);
    }
  }

  async function savePath() {
    const fullPath = pathDraft.trim();
    if (!fullPath) {
      setError("Serve il percorso della cartella.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setLocalFolderPath(fullPath);
      await updateVaultMeta({ cloudFolderPath: fullPath });
      setMeta(await getVaultMeta());
      setMessage("Percorso salvato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
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
          ? `Inviate ${result.processed} foto al cloud.`
          : result.errors[0] || "Tutto aggiornato."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync non riuscito");
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
          ? `Scaricate ${imported} foto dal cloud.`
          : "Nessuna foto da scaricare per ora."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download non riuscito");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectCloud();
      setPathDraft("");
      setMeta(await getVaultMeta());
      setMessage("Cloud scollegato. Le foto restano su questo telefono/PC.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnessione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-2">
        <h2 className="font-[family-name:var(--font-serif)] text-3xl">
          Dove salvare le foto
        </h2>
        <p className="text-base text-[var(--ink-muted)]">
          Scegli <strong>una volta</strong> dove mettere le foto di lavoro.
          Poi Stippo ci scrive da solo.
        </p>
      </div>

      {connected ? (
        <div className="vm-card space-y-4 p-5">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="font-medium">Sei collegato</p>
          </div>

          <p className="text-sm text-[var(--ink)]">
            {providerLabel(connected.cloudProvider)}
            {connected.cloudFolderName
              ? ` · cartella “${connected.cloudFolderName}”`
              : ""}
          </p>

          {connected.cloudProvider === "local_folder" ? (
            <div>
              <label className="vm-label" htmlFor="vault-path">
                Indirizzo completo della cartella
              </label>
              <input
                id="vault-path"
                className="vm-input font-mono text-xs"
                value={pathDraft}
                onChange={(e) => setPathDraft(e.target.value)}
                placeholder="C:\Users\...\Google Drive\Stippo"
                spellCheck={false}
              />
              <button
                type="button"
                className="vm-btn-secondary mt-2"
                disabled={busy}
                onClick={() => void savePath()}
              >
                Salva indirizzo
              </button>
              {connected.cloudFolderPath ? (
                <p className="mt-2 break-all font-mono text-xs text-[var(--ink-muted)]">
                  {connected.cloudFolderPath}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--ink-muted)]">
              Le foto vanno sul <strong>tuo</strong>{" "}
              {connected.cloudProvider === "dropbox" ? "Dropbox" : "Google Drive"},
              nella cartella Stippo. Non finiscono sul server di Stippo.
            </p>
          )}

          {connected.lastSyncAt ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Ultimo aggiornamento{" "}
              {new Date(connected.lastSyncAt).toLocaleString()}
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
              Aggiorna ora
            </button>
            <button
              type="button"
              className="vm-btn-secondary"
              disabled={busy}
              onClick={() => void pullNow()}
            >
              Scarica da cloud
            </button>
            <button
              type="button"
              className="vm-btn-ghost"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              Scollega
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Step 1 — phone / primary */}
          <div className="vm-card space-y-4 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              Passo 1 · Telefono o PC
            </p>
            <p className="text-base text-[var(--ink)]">
              Premi il pulsante. Si apre Google. Entri col <strong>tuo</strong>{" "}
              Gmail. Fine.
            </p>

            <button
              type="button"
              className="vm-btn-primary w-full !py-3.5 text-base"
              disabled={busy || !driveReady}
              onClick={() => void connect("google_drive")}
            >
              <Cloud className="h-4 w-4" />
              Usa il mio Google Drive
            </button>

            {!driveReady ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Prima l’amministratore di Stippo deve configurare Google (una
                sola volta). Poi questo pulsante si attiva.
                <br />
                <span className="text-xs">
                  Script: <code>pnpm setup:drive</code>
                </span>
              </p>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">
                Non ti chiediamo password di Stippo sul Drive. Solo il permesso
                di creare una cartella chiamata Stippo.
              </p>
            )}

            {dropboxReady ? (
              <button
                type="button"
                className="vm-btn-secondary w-full"
                disabled={busy}
                onClick={() => void connect("dropbox")}
              >
                Oppure usa Dropbox
              </button>
            ) : null}
          </div>

          {/* Step 2 — desktop optional */}
          <div className="vm-card space-y-3 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              Solo se sei al computer
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Alternativa: scegli una cartella già dentro Drive/Dropbox sul PC
              (senza login Google in Stippo).
            </p>
            <button
              type="button"
              className="vm-btn-secondary w-full"
              disabled={busy || !folderSupported}
              onClick={() => void connect("local_folder")}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
              Scegli cartella sul PC
            </button>
            {!folderSupported ? (
              <p className="text-xs text-[var(--ink-muted)]">
                Sul telefono usa Google Drive qui sopra.
              </p>
            ) : null}
          </div>
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

      <div className="space-y-2 px-1 text-sm text-[var(--ink-muted)]">
        <p className="font-medium text-[var(--ink)]">In due parole</p>
        <p>
          1. Colleghi Drive una volta.
          <br />
          2. Fai le foto in Stippo.
          <br />
          3. Le ritrovi sul tuo Drive (e sul PC se hai Drive installato).
        </p>
      </div>
    </div>
  );
}

function providerLabel(id: string): string {
  switch (id) {
    case "google_drive":
      return "Google Drive";
    case "dropbox":
      return "Dropbox";
    case "local_folder":
      return "Cartella sul PC";
    case "onedrive":
      return "OneDrive";
    default:
      return id;
  }
}
