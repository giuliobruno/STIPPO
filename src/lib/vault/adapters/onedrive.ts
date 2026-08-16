import type {
  RemoteRef,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";
import {
  migrateLegacyLocalStorage,
  secureGet,
  secureRemove,
  secureSet,
} from "@/lib/vault/secure-store";
import { getVaultOAuthConfig } from "@/lib/vault/oauth-config";
import {
  cleanOAuthParamsFromUrl,
  loadPkcePending,
  pkceChallenge,
  randomString,
  savePkcePending,
  vaultOAuthRedirectUri,
} from "@/lib/vault/pkce";

const TOKEN_KEY = "stippo_onedrive_token";
const FOLDER_KEY = "stippo_onedrive_folder";
const PKCE_KEY = "stippo_onedrive_pkce";
const ROOT_NAME = "Stippo";
const SCOPES = ["offline_access", "Files.ReadWrite", "User.Read"].join(" ");
const GRAPH = "https://graph.microsoft.com/v1.0";
const AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0";
const SIMPLE_UPLOAD_MAX = 4 * 1024 * 1024;

type TokenBundle = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

/**
 * OneDrive adapter — Microsoft identity PKCE (SPA, no client secret).
 * Creates /Stippo on the user's OneDrive and syncs under that folder.
 */
export function createOneDriveAdapter(): VaultSyncAdapter {
  let folderId: string | null = null;

  return {
    id: "onedrive",
    label: "OneDrive",

    async connect(): Promise<VaultLocation> {
      const clientId = await resolveClientId();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const pending = loadPkcePending(PKCE_KEY);

      if (code && pending && state === pending.state) {
        const token = await exchangeCode(clientId, code, pending.verifier);
        await saveToken(token);
        sessionStorage.removeItem(PKCE_KEY);
        cleanOAuthParamsFromUrl();
        const folder = await ensureStippoFolder(token.accessToken);
        folderId = folder.id;
        await secureSet(FOLDER_KEY, { id: folder.id, name: folder.name });
        try {
          localStorage.removeItem(FOLDER_KEY);
        } catch {
          /* ignore */
        }
        return {
          provider: "onedrive",
          folderId: folder.id,
          folderName: folder.name,
          displayPath: `OneDrive / ${folder.name}`,
        };
      }

      const verifier = randomString(64);
      const challenge = await pkceChallenge(verifier);
      const oauthState = `onedrive.${randomString(24)}`;
      savePkcePending(PKCE_KEY, {
        verifier,
        state: oauthState,
        startedAt: Date.now(),
      });
      const auth = new URL(`${AUTH}/authorize`);
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("redirect_uri", vaultOAuthRedirectUri());
      auth.searchParams.set("response_mode", "query");
      auth.searchParams.set("scope", SCOPES);
      auth.searchParams.set("code_challenge", challenge);
      auth.searchParams.set("code_challenge_method", "S256");
      auth.searchParams.set("state", oauthState);
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
      folderId = null;
    },

    async isConnected(): Promise<boolean> {
      const t = await loadToken();
      if (!t) return false;
      const folder = await loadFolder();
      if (folder) folderId = folder.id;
      return Boolean(folderId || folder);
    },

    async getLocation(): Promise<VaultLocation | null> {
      const folder = await loadFolder();
      if (!folder) return null;
      return {
        provider: "onedrive",
        folderId: folder.id,
        folderName: folder.name,
        displayPath: `OneDrive / ${folder.name}`,
      };
    },

    async push(relativePath, data, mimeType): Promise<RemoteRef> {
      const accessToken = await getValidToken();
      const root = await getRootFolderId(accessToken);
      await ensureParentFolders(accessToken, root, relativePath);
      const itemPath = graphPath(relativePath);
      const item = await uploadFile(accessToken, root, itemPath, data, mimeType);
      return {
        id: item.id,
        name: item.name,
        path: relativePath,
        mimeType,
        size: data.size,
      };
    },

    async pull(relativePath): Promise<Blob | null> {
      const accessToken = await getValidToken();
      const root = await getRootFolderId(accessToken);
      const itemPath = graphPath(relativePath);
      const res = await fetch(
        `${GRAPH}/me/drive/items/${root}:/${encodePath(itemPath)}:/content`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.blob();
    },

    async list(prefix = ""): Promise<RemoteRef[]> {
      const accessToken = await getValidToken();
      const root = await getRootFolderId(accessToken);
      const folderPath = prefix ? graphPath(prefix) : "";
      const url = folderPath
        ? `${GRAPH}/me/drive/items/${root}:/${encodePath(folderPath)}:/children?$top=200`
        : `${GRAPH}/me/drive/items/${root}/children?$top=200`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("OneDrive list failed");
      const json = (await res.json()) as {
        value: Array<{
          id: string;
          name: string;
          file?: { mimeType?: string };
          size?: number;
          lastModifiedDateTime?: string;
          folder?: unknown;
        }>;
      };
      return (json.value || [])
        .filter((e) => !e.folder)
        .map((e) => ({
          id: e.id,
          name: e.name,
          path: prefix ? `${prefix}/${e.name}` : e.name,
          mimeType: e.file?.mimeType,
          size: e.size,
          modifiedTime: e.lastModifiedDateTime,
        }));
    },

    async remove(relativePath): Promise<void> {
      const accessToken = await getValidToken();
      const root = await getRootFolderId(accessToken);
      const itemPath = graphPath(relativePath);
      await fetch(
        `${GRAPH}/me/drive/items/${root}:/${encodePath(itemPath)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    },
  };

  async function getRootFolderId(accessToken: string): Promise<string> {
    if (folderId) return folderId;
    const saved = await loadFolder();
    if (saved) {
      folderId = saved.id;
      return saved.id;
    }
    const folder = await ensureStippoFolder(accessToken);
    folderId = folder.id;
    return folder.id;
  }
}

export function oneDriveOAuthPending(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const pending = loadPkcePending(PKCE_KEY);
  const state = params.get("state");
  return Boolean(params.get("code") && pending && state === pending.state);
}

async function resolveClientId(): Promise<string> {
  const cfg = await getVaultOAuthConfig();
  if (!cfg.oneDrive?.clientId) {
    throw new Error(
      "OneDrive non è configurato. Apri Dove salvare le foto e incolla il Client ID (una sola volta)."
    );
  }
  return cfg.oneDrive.clientId;
}

async function exchangeCode(
  clientId: string,
  code: string,
  verifier: string
): Promise<TokenBundle> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: vaultOAuthRedirectUri(),
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const res = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OneDrive token exchange failed: ${err}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    refreshToken: json.refresh_token,
  };
}

async function ensureStippoFolder(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const existingRes = await fetch(
    `${GRAPH}/me/drive/root:/${encodeURIComponent(ROOT_NAME)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (existingRes.ok) {
    const folder = (await existingRes.json()) as { id: string; name: string };
    return folder;
  }

  const create = await fetch(`${GRAPH}/me/drive/root/children`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: ROOT_NAME,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });
  if (!create.ok) {
    const retry = await fetch(
      `${GRAPH}/me/drive/root:/${encodeURIComponent(ROOT_NAME)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (retry.ok) {
      return (await retry.json()) as { id: string; name: string };
    }
    throw new Error("Could not create Stippo folder on OneDrive");
  }
  return (await create.json()) as { id: string; name: string };
}

async function ensureParentFolders(
  accessToken: string,
  rootId: string,
  relativePath: string
): Promise<void> {
  const parts = relativePath.split("/").filter(Boolean);
  parts.pop();
  let parentId = rootId;
  let built = "";
  for (const part of parts) {
    built = built ? `${built}/${part}` : part;
    const existing = await getChildByName(accessToken, parentId, part);
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const res = await fetch(`${GRAPH}/me/drive/items/${parentId}/children`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: part,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    if (!res.ok) {
      const again = await getChildByName(accessToken, parentId, part);
      if (again) {
        parentId = again.id;
        continue;
      }
      throw new Error(`Could not create OneDrive folder ${built}`);
    }
    const created = (await res.json()) as { id: string };
    parentId = created.id;
  }
}

async function getChildByName(
  accessToken: string,
  parentId: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const res = await fetch(
    `${GRAPH}/me/drive/items/${parentId}/children?$select=id,name,folder&$top=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    value: Array<{ id: string; name: string }>;
  };
  return json.value?.find((v) => v.name === name) || null;
}

async function uploadFile(
  accessToken: string,
  rootId: string,
  itemPath: string,
  data: Blob,
  mimeType: string
): Promise<{ id: string; name: string }> {
  if (data.size <= SIMPLE_UPLOAD_MAX) {
    const res = await fetch(
      `${GRAPH}/me/drive/items/${rootId}:/${encodePath(itemPath)}:/content`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": mimeType || "application/octet-stream",
        },
        body: data,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OneDrive upload failed: ${res.status} ${err}`);
    }
    return (await res.json()) as { id: string; name: string };
  }

  const sessionRes = await fetch(
    `${GRAPH}/me/drive/items/${rootId}:/${encodePath(itemPath)}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        item: {
          "@microsoft.graph.conflictBehavior": "replace",
          name: itemPath.split("/").pop(),
        },
      }),
    }
  );
  if (!sessionRes.ok) {
    const err = await sessionRes.text();
    throw new Error(`OneDrive upload session failed: ${err}`);
  }
  const session = (await sessionRes.json()) as { uploadUrl: string };
  const buffer = await data.arrayBuffer();
  const chunkSize = 5 * 1024 * 1024;
  let offset = 0;
  let last: { id: string; name: string } | null = null;
  while (offset < buffer.byteLength) {
    const end = Math.min(offset + chunkSize, buffer.byteLength);
    const chunk = buffer.slice(offset, end);
    const put = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${offset}-${end - 1}/${buffer.byteLength}`,
      },
      body: chunk,
    });
    if (!put.ok && put.status !== 202) {
      const err = await put.text();
      throw new Error(`OneDrive chunk upload failed: ${put.status} ${err}`);
    }
    if (put.status === 200 || put.status === 201) {
      last = (await put.json()) as { id: string; name: string };
    }
    offset = end;
  }
  if (!last) throw new Error("OneDrive upload incomplete");
  return last;
}

function graphPath(relativePath: string): string {
  return relativePath.replace(/^\/+/, "").replace(/\/+/g, "/");
}

function encodePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((p) => encodeURIComponent(p))
    .join("/");
}

async function getValidToken(): Promise<string> {
  const t = await loadToken();
  if (!t) throw new Error("OneDrive non collegato");
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken;
  if (!t.refreshToken) {
    throw new Error("OneDrive: sessione scaduta — ricollega in Impostazioni vault");
  }
  const clientId = await resolveClientId();
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: t.refreshToken,
    scope: SCOPES,
  });
  const res = await fetch(`${AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error("OneDrive refresh fallito — ricollega in Impostazioni vault");
  }
  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  const next: TokenBundle = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    refreshToken: json.refresh_token || t.refreshToken,
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

async function loadFolder(): Promise<{ id: string; name: string } | null> {
  const migrated = await migrateLegacyLocalStorage<{ id: string; name: string }>(
    FOLDER_KEY,
    FOLDER_KEY
  );
  if (migrated) return migrated;
  return secureGet<{ id: string; name: string }>(FOLDER_KEY);
}
