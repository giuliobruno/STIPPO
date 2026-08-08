/**
 * Production environment guards. Call from instrumentation on boot.
 */

const REQUIRED_PROD = ["NEXTAUTH_SECRET", "NEXTAUTH_URL", "DATABASE_URL"] as const;

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_PROD.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(
      `[stippo] Missing required production env: ${missing.join(", ")}`
    );
  }

  const secret = process.env.NEXTAUTH_SECRET!;
  if (secret.length < 32) {
    throw new Error(
      "[stippo] NEXTAUTH_SECRET must be at least 32 characters in production"
    );
  }

  const url = process.env.NEXTAUTH_URL!;
  if (!url.startsWith("https://") && !url.includes("localhost")) {
    throw new Error(
      "[stippo] NEXTAUTH_URL must be https:// in production (or localhost for rare self-host tests)"
    );
  }

  if (
    process.env.DATABASE_URL?.startsWith("file:") &&
    process.env.ALLOW_SQLITE_IN_PRODUCTION !== "true"
  ) {
    throw new Error(
      "[stippo] SQLite (file:) is not allowed in production. Use Postgres, or set ALLOW_SQLITE_IN_PRODUCTION=true for an emergency."
    );
  }
}

/** Legacy server uploads of full-res media — off in production by default. */
export function serverMediaUploadsEnabled() {
  if (process.env.ALLOW_SERVER_MEDIA_UPLOADS === "true") return true;
  if (process.env.ALLOW_SERVER_MEDIA_UPLOADS === "false") return false;
  return process.env.NODE_ENV !== "production";
}
