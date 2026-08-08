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

const TOKEN_KEY = "stippo_gdrive_token";
const FOLDER_KEY = "stippo_gdrive_folder";
const ROOT_NAME = "Stippo";

type TokenBundle = {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
};

/**
 * Google Drive adapter — scope drive.file (only Stippo folder).
 * Uses Google Identity Services token client when GOOGLE_CLIENT_ID is set
 * via NEXT_PUBLIC_GOOGLE_CLIENT_ID.
 */
export function createGoogleDriveAdapter(): VaultSyncAdapter {
  let folderId: string | null = null;

  return {
    id: "google_drive",
    label: "Google Drive",

    async connect(): Promise<VaultLocation> {
      const token = await requestAccessToken();
      await saveToken(token);
      const folder = await ensureStippoFolder(token.accessToken);
      folderId = folder.id;
      await secureSet(FOLDER_KEY, { id: folder.id, name: folder.name });
      try {
        localStorage.removeItem(FOLDER_KEY);
      } catch {
        /* ignore */
      }
      return {
        provider: "google_drive",
        folderId: folder.id,
        folderName: folder.name,
        displayPath: `Google Drive / ${folder.name}`,
      };
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
      folderId = null;
    },

    async isConnected(): Promise<boolean> {
      const t = await loadToken();
      if (!t) return false;
      const folder = await loadFolder();
      if (folder) {
        folderId = folder.id;
      }
      return Boolean(folderId);
    },

    async getLocation(): Promise<VaultLocation | null> {
      const folder = await loadFolder();
      if (!folder) return null;
      return {
        provider: "google_drive",
        folderId: folder.id,
        folderName: folder.name,
        displayPath: `Google Drive / ${folder.name}`,
      };
    },

    async push(relativePath, data, mimeType): Promise<RemoteRef> {
      const accessToken = await getValidToken();
      const parent = await resolveParent(accessToken, relativePath);
      const name = relativePath.split("/").pop() || relativePath;
      const existing = await findChild(accessToken, parent, name);

      if (existing) {
        const res = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": mimeType,
            },
            body: data,
          }
        );
        if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
        return {
          id: existing.id,
          name,
          path: relativePath,
          mimeType,
          size: data.size,
        };
      }

      const metadata = {
        name,
        parents: [parent],
        mimeType,
      };
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      );
      form.append("file", data, name);

      const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Drive upload failed: ${res.status} ${err}`);
      }
      const json = (await res.json()) as { id: string; name: string };
      return {
        id: json.id,
        name: json.name,
        path: relativePath,
        mimeType,
        size: data.size,
      };
    },

    async pull(relativePath): Promise<Blob | null> {
      const accessToken = await getValidToken();
      const parent = await resolveParent(accessToken, relativePath);
      const name = relativePath.split("/").pop() || relativePath;
      const file = await findChild(accessToken, parent, name);
      if (!file) return null;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      return res.blob();
    },

    async list(prefix = ""): Promise<RemoteRef[]> {
      const accessToken = await getValidToken();
      const parent = prefix
        ? await resolveParent(accessToken, `${prefix}/x`)
        : await getRootFolderId(accessToken);
      const q = `'${parent}' in parents and trashed=false`;
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=200`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error("Drive list failed");
      const json = (await res.json()) as {
        files: Array<{
          id: string;
          name: string;
          mimeType?: string;
          size?: string;
          modifiedTime?: string;
        }>;
      };
      return (json.files || []).map((f) => ({
        id: f.id,
        name: f.name,
        path: prefix ? `${prefix}/${f.name}` : f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : undefined,
        modifiedTime: f.modifiedTime,
      }));
    },

    async remove(relativePath): Promise<void> {
      const accessToken = await getValidToken();
      const parent = await resolveParent(accessToken, relativePath);
      const name = relativePath.split("/").pop() || relativePath;
      const file = await findChild(accessToken, parent, name);
      if (!file) return;
      await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
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

  /** Ensure parent folders for path exist under Stippo root. */
  async function resolveParent(
    accessToken: string,
    relativePath: string
  ): Promise<string> {
    const parts = relativePath.split("/").filter(Boolean);
    parts.pop(); // filename
    let parent = await getRootFolderId(accessToken);
    for (const part of parts) {
      const existing = await findChild(accessToken, parent, part);
      if (existing) {
        parent = existing.id;
        continue;
      }
      const res = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parent],
        }),
      });
      if (!res.ok) throw new Error("Could not create Drive folder");
      const json = (await res.json()) as { id: string };
      parent = json.id;
    }
    return parent;
  }
}

async function ensureStippoFolder(
  accessToken: string
): Promise<{ id: string; name: string }> {
  const q = `name='${ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Drive folder lookup failed");
  const json = (await res.json()) as { files: Array<{ id: string; name: string }> };
  if (json.files?.[0]) return json.files[0];

  const create = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: ROOT_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!create.ok) throw new Error("Could not create Stippo folder on Drive");
  const folder = (await create.json()) as { id: string; name: string };
  return folder;
}

async function findChild(
  accessToken: string,
  parentId: string,
  name: string
): Promise<{ id: string; name: string } | null> {
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { files: Array<{ id: string; name: string }> };
  return json.files?.[0] || null;
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

async function getValidToken(): Promise<string> {
  const t = await loadToken();
  if (t && t.expiresAt > Date.now() + 60_000) return t.accessToken;
  const fresh = await requestAccessToken();
  await saveToken(fresh);
  return fresh.accessToken;
}

async function requestAccessToken(): Promise<TokenBundle> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to connect Google Drive. Create an OAuth client in Google Cloud Console with Drive API enabled."
    );
  }

  await loadGisScript();

  return new Promise((resolve, reject) => {
    const google = (
      window as unknown as {
        google?: {
          accounts: {
            oauth2: {
              initTokenClient: (cfg: Record<string, unknown>) => {
                requestAccessToken: (opts?: { prompt?: string }) => void;
              };
            };
          };
        };
      }
    ).google;

    if (!google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services not available"));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google auth failed"));
          return;
        }
        resolve({
          accessToken: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in || 3600) * 1000,
        });
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (
      (window as unknown as { google?: { accounts?: unknown } }).google?.accounts
    ) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-stippo-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.dataset.stippoGis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}
