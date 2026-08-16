import type {
  RemoteRef,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";
import {
  migrateLegacyLocalStorage,
  secureRemove,
  secureSet,
} from "@/lib/vault/secure-store";
import { getVaultOAuthConfig } from "@/lib/vault/oauth-config";
import {
  cleanOAuthParamsFromUrl,
  pkceChallenge,
  randomString,
  vaultOAuthRedirectUri,
} from "@/lib/vault/pkce";

const TOKEN_KEY = "stippo_dropbox_token";
const FOLDER_KEY = "stippo_dropbox_folder";
const PKCE_KEY = "stippo_dropbox_pkce";
const ROOT = "/Stippo";

type TokenBundle = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
  accountId?: string;
};

/**
 * Dropbox adapter — OAuth PKCE (no app secret in browser).
 * App key comes from /api/vault/oauth-config (DROPBOX_APP_KEY on the server).
 */
export function createDropboxAdapter(): VaultSyncAdapter {
  return {
    id: "dropbox",
    label: "Dropbox",

    async connect(): Promise<VaultLocation> {
      const appKey = await resolveAppKey();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const pending = sessionStorage.getItem(PKCE_KEY);

      if (code && pending && (!state || state === "dropbox")) {
        const { verifier } = JSON.parse(pending) as { verifier: string };
        const token = await exchangeCode(appKey, code, verifier);
        await saveToken(token);
        sessionStorage.removeItem(PKCE_KEY);
        cleanOAuthParamsFromUrl();
        await ensureRoot(token.accessToken);
        await secureSet(FOLDER_KEY, { id: ROOT, name: "Stippo" });
        try {
          localStorage.removeItem(FOLDER_KEY);
        } catch {
          /* ignore */
        }
        return {
          provider: "dropbox",
          folderId: ROOT,
          folderName: "Stippo",
          displayPath: "Dropbox / Stippo",
        };
      }

      const verifier = randomString(64);
      const challenge = await pkceChallenge(verifier);
      sessionStorage.setItem(
        PKCE_KEY,
        JSON.stringify({ verifier, startedAt: Date.now() })
      );
      const auth = new URL("https://www.dropbox.com/oauth2/authorize");
      auth.searchParams.set("client_id", appKey);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("token_access_type", "offline");
      auth.searchParams.set("code_challenge", challenge);
      auth.searchParams.set("code_challenge_method", "S256");
      auth.searchParams.set("redirect_uri", vaultOAuthRedirectUri());
      auth.searchParams.set("state", "dropbox");
      window.location.href = auth.toString();
      return new Promise(() => undefined);
    },

    async disconnect(): Promise<void> {
      await secureRemove(TOKEN_KEY);
      await secureRemove(FOLDER_KEY);
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(FOLDER_KEY);
      } catch {
        /* ignore */
      }
      sessionStorage.removeItem(PKCE_KEY);
    },

    async isConnected(): Promise<boolean> {
      const t = await loadToken();
      return Boolean(t?.accessToken);
    },

    async getLocation(): Promise<VaultLocation | null> {
      if (!(await this.isConnected())) return null;
      return {
        provider: "dropbox",
        folderId: ROOT,
        folderName: "Stippo",
        displayPath: "Dropbox / Stippo",
      };
    },

    async push(relativePath, data, mimeType): Promise<RemoteRef> {
      const accessToken = await getValidToken();
      const path = dropboxPath(relativePath);
      const res = await fetch(
        "https://content.dropboxapi.com/2/files/upload",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({
              path,
              mode: "overwrite",
              autorename: false,
              mute: true,
            }),
          },
          body: data,
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Dropbox upload failed: ${res.status} ${err}`);
      }
      const json = (await res.json()) as {
        id?: string;
        name: string;
        path_display?: string;
      };
      return {
        id: json.id || path,
        name: json.name,
        path: relativePath,
        mimeType,
        size: data.size,
      };
    },

    async pull(relativePath): Promise<Blob | null> {
      const accessToken = await getValidToken();
      const path = dropboxPath(relativePath);
      const res = await fetch(
        "https://content.dropboxapi.com/2/files/download",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Dropbox-API-Arg": JSON.stringify({ path }),
          },
        }
      );
      if (res.status === 409 || res.status === 404) return null;
      if (!res.ok) return null;
      return res.blob();
    },

    async list(prefix = ""): Promise<RemoteRef[]> {
      const accessToken = await getValidToken();
      const path = prefix ? dropboxPath(prefix) : ROOT;
      const res = await fetch(
        "https://api.dropboxapi.com/2/files/list_folder",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path, recursive: false }),
        }
      );
      if (!res.ok) throw new Error("Dropbox list failed");
      const json = (await res.json()) as {
        entries: Array<{
          ".tag": string;
          id?: string;
          name: string;
          path_display?: string;
          size?: number;
        }>;
      };
      return (json.entries || [])
        .filter((e) => e[".tag"] === "file")
        .map((e) => ({
          id: e.id || e.name,
          name: e.name,
          path: prefix ? `${prefix}/${e.name}` : e.name,
          size: e.size,
        }));
    },

    async remove(relativePath): Promise<void> {
      const accessToken = await getValidToken();
      await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: dropboxPath(relativePath) }),
      });
    },
  };
}

function dropboxPath(relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "");
  return `${ROOT}/${cleaned}`.replace(/\/+/g, "/");
}

async function resolveAppKey(): Promise<string> {
  const cfg = await getVaultOAuthConfig();
  if (!cfg.dropbox?.appKey) {
    throw new Error(
      "Dropbox non è configurato su questo server. Contatta chi gestisce Stippo."
    );
  }
  return cfg.dropbox.appKey;
}

async function ensureRoot(accessToken: string): Promise<void> {
  const res = await fetch(
    "https://api.dropboxapi.com/2/files/create_folder_v2",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: ROOT, autorename: false }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("conflict") || res.status === 409) return;
    throw new Error(`Could not create Dropbox /Stippo folder: ${body}`);
  }
}

async function exchangeCode(
  appKey: string,
  code: string,
  verifier: string
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: appKey,
    code_verifier: verifier,
    redirect_uri: vaultOAuthRedirectUri(),
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox token exchange failed: ${err}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
    account_id?: string;
  };
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 14400) * 1000,
    refreshToken: json.refresh_token,
    accountId: json.account_id,
  };
}

async function getValidToken(): Promise<string> {
  const t = await loadToken();
  if (!t) throw new Error("Dropbox non collegato");
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken;
  if (!t.refreshToken) return t.accessToken;
  const appKey = await resolveAppKey();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: t.refreshToken,
    client_id: appKey,
  });
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error("Dropbox refresh fallito — ricollega in Impostazioni vault");
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  const next: TokenBundle = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 14400) * 1000,
    refreshToken: json.refresh_token || t.refreshToken,
    accountId: t.accountId,
  };
  await saveToken(next);
  return next.accessToken;
}

async function loadToken(): Promise<TokenBundle | null> {
  return migrateLegacyLocalStorage<TokenBundle>(TOKEN_KEY, TOKEN_KEY);
}

async function saveToken(token: TokenBundle) {
  await secureSet(TOKEN_KEY, token);
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Call from Vault page on load to finish OAuth redirect. */
export function dropboxOAuthPending(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  return Boolean(
    params.get("code") &&
      sessionStorage.getItem(PKCE_KEY) &&
      (!state || state === "dropbox")
  );
}
