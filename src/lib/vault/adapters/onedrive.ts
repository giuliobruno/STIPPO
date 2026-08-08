import type {
  RemoteRef,
  VaultLocation,
  VaultSyncAdapter,
} from "@/lib/vault/types";

const TOKEN_KEY = "stippo_onedrive_token";
const FOLDER_KEY = "stippo_onedrive_folder";

/**
 * OneDrive / Microsoft Graph adapter stub — same interface as Drive.
 * Requires NEXT_PUBLIC_MSAL_CLIENT_ID. Full MSAL wiring in Fase 5.
 */
export function createOneDriveAdapter(): VaultSyncAdapter {
  return {
    id: "onedrive",
    label: "OneDrive",

    async connect(): Promise<VaultLocation> {
      const clientId = process.env.NEXT_PUBLIC_MSAL_CLIENT_ID;
      if (!clientId) {
        throw new Error(
          "OneDrive requires NEXT_PUBLIC_MSAL_CLIENT_ID. Use Google Drive or a local sync folder for now."
        );
      }
      // Placeholder: redirect-based OAuth would go here
      throw new Error(
        "OneDrive OAuth is scaffolded — set MSAL client and complete consent flow. Prefer Google Drive for MVP."
      );
    },

    async disconnect(): Promise<void> {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(FOLDER_KEY);
    },

    async isConnected(): Promise<boolean> {
      return Boolean(localStorage.getItem(TOKEN_KEY));
    },

    async getLocation(): Promise<VaultLocation | null> {
      try {
        const raw = localStorage.getItem(FOLDER_KEY);
        if (!raw) return null;
        const folder = JSON.parse(raw) as { id: string; name: string };
        return {
          provider: "onedrive",
          folderId: folder.id,
          folderName: folder.name,
          displayPath: `OneDrive / ${folder.name}`,
        };
      } catch {
        return null;
      }
    },

    async push(relativePath: string, data: Blob, mimeType: string): Promise<RemoteRef> {
      void relativePath;
      void data;
      void mimeType;
      throw new Error("OneDrive not connected");
    },

    async pull(relativePath: string): Promise<Blob | null> {
      void relativePath;
      return null;
    },

    async list(): Promise<RemoteRef[]> {
      return [];
    },
  };
}
