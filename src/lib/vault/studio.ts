/**
 * Studio / Team tier scaffolding (post-PMF).
 * Shared Drive folder for a studio — vault lives in a shared Google Drive folder.
 */
export type StudioPlanConfig = {
  seats: number;
  sharedVaultFolderId: string | null;
  sharedVaultProvider: "google_drive" | "onedrive" | null;
};

export const STUDIO_DEFAULTS: StudioPlanConfig = {
  seats: 3,
  sharedVaultFolderId: null,
  sharedVaultProvider: null,
};

export const PLAN_FEATURES = {
  free: {
    memories: 100,
    videoMaxMs: 30_000,
    cloudProviders: 1,
    batchImport: false,
    sharedVault: false,
  },
  pro: {
    memories: Number.POSITIVE_INFINITY,
    videoMaxMs: 5 * 60_000,
    cloudProviders: 2,
    batchImport: true,
    sharedVault: false,
  },
  team: {
    memories: Number.POSITIVE_INFINITY,
    videoMaxMs: 5 * 60_000,
    cloudProviders: 3,
    batchImport: true,
    sharedVault: true,
  },
} as const;
