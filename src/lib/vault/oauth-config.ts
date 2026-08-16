export type VaultOAuthConfig = {
  googleDrive: { clientId: string } | null;
  dropbox: { appKey: string } | null;
  oneDrive: { clientId: string } | null;
  meta?: {
    anyConfigured: boolean;
    canConfigureInApp: boolean;
    sources?: {
      googleDrive: "env" | "db" | null;
      dropbox: "env" | "db" | null;
      oneDrive: "env" | "db" | null;
    };
    lockedByEnv?: {
      googleClientId: boolean;
      dropboxAppKey: boolean;
      oneDriveClientId: boolean;
    };
  };
};

let cached: VaultOAuthConfig | null = null;
let inflight: Promise<VaultOAuthConfig> | null = null;

export async function getVaultOAuthConfig(): Promise<VaultOAuthConfig> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch("/api/vault/oauth-config", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Impossibile caricare la configurazione cloud");
    }
    const json = (await res.json()) as VaultOAuthConfig;
    cached = {
      googleDrive: json.googleDrive?.clientId
        ? { clientId: json.googleDrive.clientId }
        : null,
      dropbox: json.dropbox?.appKey ? { appKey: json.dropbox.appKey } : null,
      oneDrive: json.oneDrive?.clientId
        ? { clientId: json.oneDrive.clientId }
        : null,
      meta: json.meta,
    };
    return cached;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function clearVaultOAuthConfigCache() {
  cached = null;
}

export async function saveVaultOAuthConfig(input: {
  googleClientId?: string;
  dropboxAppKey?: string;
  oneDriveClientId?: string;
}): Promise<VaultOAuthConfig> {
  const res = await fetch("/api/vault/oauth-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Salvataggio non riuscito");
  }
  clearVaultOAuthConfigCache();
  return getVaultOAuthConfig();
}
