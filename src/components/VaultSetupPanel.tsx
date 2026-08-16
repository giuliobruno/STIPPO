"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Cloud,
  Settings2,
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
import {
  clearVaultOAuthConfigCache,
  getVaultOAuthConfig,
  saveVaultOAuthConfig,
  type VaultOAuthConfig,
} from "@/lib/vault/oauth-config";
import type { CloudProviderId, VaultMeta } from "@/lib/vault/types";

export function VaultSetupPanel() {
  const [meta, setMeta] = useState<VaultMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderSupported, setFolderSupported] = useState(true);
  const [pathDraft, setPathDraft] = useState("");
  const [oauth, setOauth] = useState<VaultOAuthConfig | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [googleClientId, setGoogleClientId] = useState("");

  async function reloadOauth() {
    clearVaultOAuthConfigCache();
    const cfg = await getVaultOAuthConfig();
    setOauth(cfg);
    if (!cfg.googleDrive?.clientId) setShowSetup(true);
    return cfg;
  }

  useEffect(() => {
    setFolderSupported(
      typeof window !== "undefined" && "showDirectoryPicker" in window
    );

    void reloadOauth().catch(() =>
      setOauth({
        googleDrive: null,
        dropbox: null,
        oneDrive: null,
        meta: { anyConfigured: false, canConfigureInApp: true },
      })
    );

    void initVault().then(async () => {
      const m = await getVaultMeta();
      setMeta(m);
      setPathDraft(
        m.cloudFolderPath || getLocalFolderPath() || m.cloudFolderName || ""
      );
    });
  }, []);

  const connected =
    meta?.cloudProvider && meta.cloudProvider !== "none" ? meta : null;

  const driveReady = Boolean(oauth?.googleDrive?.clientId);

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
      if (provider === "google_drive" && !driveReady) {
        setShowSetup(true);
        throw new Error(
          "Google Drive non è ancora configurato. Incolla il Client ID qui sotto (una sola volta)."
        );
      }
      await finishConnect(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Qualcosa non ha funzionato");
    } finally {
      setBusy(false);
    }
  }

  async function saveOauthSetup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const cfg = await saveVaultOAuthConfig({
        googleClientId,
      });
      setOauth(cfg);
      if (cfg.googleDrive?.clientId) {
        setShowSetup(false);
        setMessage(
          "Google Drive configurato. Ora puoi premere “Usa Google Drive”."
        );
      } else {
        setMessage("Inserisci un Client ID Google valido per attivarlo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
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
              Le foto vanno sul <strong>tuo</strong> Google Drive, nella cartella
              Stippo. Non finiscono sul server di Stippo.
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
          {!driveReady || showSetup ? (
            <div className="vm-card space-y-4 p-5">
              <div className="flex items-start gap-2">
                <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ink-muted)]" />
                <div>
                  <p className="font-medium text-[var(--ink)]">
                    Attiva Google Drive (una sola volta)
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">
                    Incolla il Client ID OAuth dell’app. Poi ogni utente entra
                    col proprio Gmail.
                  </p>
                </div>
              </div>

              <form onSubmit={saveOauthSetup} className="space-y-4">
                <div>
                  <label className="vm-label" htmlFor="google-client-id">
                    Google Drive — Client ID
                  </label>
                  <input
                    id="google-client-id"
                    className="vm-input font-mono text-xs"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="123456789-xxxx.apps.googleusercontent.com"
                    spellCheck={false}
                    disabled={Boolean(oauth?.meta?.lockedByEnv?.googleClientId)}
                  />
                  <p className="mt-1.5 text-xs text-[var(--ink-muted)]">
                    1){" "}
                    <a
                      className="underline"
                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abilita Drive API
                    </a>
                    {" · "}
                    2){" "}
                    <a
                      className="underline"
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Crea OAuth Client (Web)
                    </a>
                    {" · "}
                    3) Origini JS autorizzate:{" "}
                    <code className="text-[11px]">
                      {typeof window !== "undefined"
                        ? window.location.origin
                        : "https://www.stippo.app"}
                    </code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="vm-btn-primary w-full"
                  disabled={busy}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salva e attiva
                </button>

                {driveReady ? (
                  <button
                    type="button"
                    className="vm-btn-ghost w-full"
                    onClick={() => setShowSetup(false)}
                  >
                    Chiudi configurazione
                  </button>
                ) : null}
              </form>
            </div>
          ) : null}

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
              Usa Google Drive
            </button>

            {driveReady ? (
              <button
                type="button"
                className="vm-btn-ghost w-full text-sm"
                onClick={() => setShowSetup(true)}
              >
                Modifica Client ID Google
              </button>
            ) : (
              <p className="text-sm text-[var(--ink-muted)]">
                Compila il riquadro sopra per attivare Google Drive. Oppure usa
                la cartella sul PC qui sotto.
              </p>
            )}
          </div>

          <div className="vm-card space-y-3 p-5">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              Sempre disponibile sul computer
            </p>
            <p className="text-sm text-[var(--ink-muted)]">
              Scegli una cartella già dentro Google Drive sul PC (senza login
              Google in Stippo). Funziona subito.
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
                Sul telefono configura Google Drive qui sopra.
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
          1. Colleghi Google Drive una volta (o scegli una cartella sul PC).
          <br />
          2. Fai le foto in Stippo.
          <br />
          3. Le ritrovi sul tuo Drive.
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
