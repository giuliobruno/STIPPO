import type {
  RemoteRef,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";

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
 * Requires NEXT_PUBLIC_DROPBOX_APP_KEY from Dropbox App Console.
 * Creates /Stippo under the linked Dropbox (or app folder root).
 */
export function createDropboxAdapter(): VaultSyncAdapter {
  return {
    id: "dropbox",
    label: "Dropbox",

    async connect(): Promise<VaultLocation> {
      const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
      if (!appKey) {
        throw new Error(
          "Set NEXT_PUBLIC_DROPBOX_APP_KEY in .env. Create an app at https://www.dropbox.com/developers/apps (Scoped access)."
        );
      }

      // Completing redirect OAuth?
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const pending = sessionStorage.getItem(PKCE_KEY);

      if (code && pending) {
        const { verifier } = JSON.parse(pending) as { verifier: string };
        const token = await exchangeCode(appKey, code, verifier);
        saveToken(token);
        sessionStorage.removeItem(PKCE_KEY);
        // Clean URL
        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("state");
        window.history.replaceState({}, "", clean.pathname);
        await ensureRoot(token.accessToken);
        localStorage.setItem(
          FOLDER_KEY,
          JSON.stringify({ id: ROOT, name: "Stippo" })
        );
        return {
          provider: "dropbox",
          folderId: ROOT,
          folderName: "Stippo",
          displayPath: "Dropbox / Stippo",
        };
      }

      // Start OAuth
      const verifier = randomString(64);
      const challenge = await pkceChallenge(verifier);
      sessionStorage.setItem(
        PKCE_KEY,
        JSON.stringify({ verifier, startedAt: Date.now() })
      );
      const redirectUri = `${window.location.origin}/app/vault`;
      const auth = new URL("https://www.dropbox.com/oauth2/authorize");
      auth.searchParams.set("client_id", appKey);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("token_access_type", "offline");
      auth.searchParams.set("code_challenge", challenge);
      auth.searchParams.set("code_challenge_method", "S256");
      auth.searchParams.set("redirect_uri", redirectUri);
      window.location.href = auth.toString();
      // Never resolves while redirecting
      return new Promise(() => undefined);
    },

    async disconnect(): Promise<void> {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(FOLDER_KEY);
      sessionStorage.removeItem(PKCE_KEY);
    },

    async isConnected(): Promise<boolean> {
      const t = loadToken();
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
      const json = (await res.json()) as { id?: string; name: string; path_display?: string };
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
  // 409 / path conflict = folder already exists
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
  const redirectUri = `${window.location.origin}/app/vault`;
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: appKey,
    code_verifier: verifier,
    redirect_uri: redirectUri,
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
  const t = loadToken();
  if (!t) throw new Error("Dropbox not connected");
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken;
  if (!t.refreshToken) return t.accessToken; // hope still valid
  const appKey = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
  if (!appKey) throw new Error("Dropbox app key missing");
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
  if (!res.ok) throw new Error("Dropbox refresh failed — reconnect in Vault settings");
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
  saveToken(next);
  return next.accessToken;
}

function loadToken(): TokenBundle | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as TokenBundle) : null;
  } catch {
    return null;
  }
}

function saveToken(token: TokenBundle) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
}

function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Call from Vault page on load to finish OAuth redirect. */
export function dropboxOAuthPending(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get("code") && sessionStorage.getItem(PKCE_KEY));
}
