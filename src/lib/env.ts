/**
 * Production environment guards. Call from instrumentation on boot.
 */

import { resolveAuthUrl } from "@/lib/auth-url";

const REQUIRED_PROD = ["NEXTAUTH_SECRET", "DATABASE_URL"] as const;

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== "production") return;
  // Avoid failing the Next.js compile/prerender phase before env is fully wired.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

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

  // Validate only — do not assign to process.env.NEXTAUTH_URL.
  // Next.js inlines that env as a string literal at build time, which would
  // turn `process.env.NEXTAUTH_URL = …` into `"https://…" = …` (invalid).
  const authUrl = resolveAuthUrl();
  if (!authUrl.startsWith("http://") && !authUrl.startsWith("https://")) {
    throw new Error("[stippo] Could not resolve a valid auth URL");
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
