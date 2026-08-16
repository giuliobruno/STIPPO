import { prisma } from "@/lib/prisma";

export const VAULT_OAUTH_KEYS = {
  googleClientId: "vault.oauth.googleClientId",
  dropboxAppKey: "vault.oauth.dropboxAppKey",
  oneDriveClientId: "vault.oauth.oneDriveClientId",
} as const;

export type VaultOAuthStored = {
  googleClientId: string;
  dropboxAppKey: string;
  oneDriveClientId: string;
};

export type VaultOAuthResolved = {
  googleDrive: { clientId: string; source: "env" | "db" } | null;
  dropbox: { appKey: string; source: "env" | "db" } | null;
  oneDrive: { clientId: string; source: "env" | "db" } | null;
  /** True when at least one provider can be used */
  anyConfigured: boolean;
  /** True when env alone has nothing — UI may offer DB setup */
  canConfigureInApp: boolean;
};

function pick(envVal: string | undefined, dbVal: string | undefined) {
  const env = envVal?.trim() || "";
  if (env) return { value: env, source: "env" as const };
  const db = dbVal?.trim() || "";
  if (db) return { value: db, source: "db" as const };
  return null;
}

export async function readStoredVaultOAuth(): Promise<VaultOAuthStored> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: {
        in: Object.values(VAULT_OAUTH_KEYS),
      },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    googleClientId: map.get(VAULT_OAUTH_KEYS.googleClientId) || "",
    dropboxAppKey: map.get(VAULT_OAUTH_KEYS.dropboxAppKey) || "",
    oneDriveClientId: map.get(VAULT_OAUTH_KEYS.oneDriveClientId) || "",
  };
}

export async function resolveVaultOAuth(): Promise<VaultOAuthResolved> {
  const stored = await readStoredVaultOAuth();

  const google = pick(
    process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    stored.googleClientId
  );
  const dropbox = pick(
    process.env.DROPBOX_APP_KEY || process.env.NEXT_PUBLIC_DROPBOX_APP_KEY,
    stored.dropboxAppKey
  );
  const oneDrive = pick(
    process.env.MSAL_CLIENT_ID ||
      process.env.ONEDRIVE_CLIENT_ID ||
      process.env.NEXT_PUBLIC_MSAL_CLIENT_ID,
    stored.oneDriveClientId
  );

  return {
    googleDrive: google
      ? { clientId: google.value, source: google.source }
      : null,
    dropbox: dropbox ? { appKey: dropbox.value, source: dropbox.source } : null,
    oneDrive: oneDrive
      ? { clientId: oneDrive.value, source: oneDrive.source }
      : null,
    anyConfigured: Boolean(google || dropbox || oneDrive),
    canConfigureInApp: true,
  };
}

export async function writeStoredVaultOAuth(
  input: Partial<VaultOAuthStored>,
  updatedBy: string
): Promise<VaultOAuthStored> {
  const entries: Array<{ key: string; value: string }> = [];
  if (input.googleClientId !== undefined) {
    entries.push({
      key: VAULT_OAUTH_KEYS.googleClientId,
      value: input.googleClientId.trim(),
    });
  }
  if (input.dropboxAppKey !== undefined) {
    entries.push({
      key: VAULT_OAUTH_KEYS.dropboxAppKey,
      value: input.dropboxAppKey.trim(),
    });
  }
  if (input.oneDriveClientId !== undefined) {
    entries.push({
      key: VAULT_OAUTH_KEYS.oneDriveClientId,
      value: input.oneDriveClientId.trim(),
    });
  }

  for (const entry of entries) {
    if (!entry.value) {
      await prisma.appSetting.deleteMany({ where: { key: entry.key } });
      continue;
    }
    await prisma.appSetting.upsert({
      where: { key: entry.key },
      create: { key: entry.key, value: entry.value, updatedBy },
      update: { value: entry.value, updatedBy },
    });
  }

  return readStoredVaultOAuth();
}
