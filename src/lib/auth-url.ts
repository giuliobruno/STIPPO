/**
 * Resolve a valid absolute origin for NextAuth / redirects.
 * Accepts bare domains (stippo.app) and fills https:// when needed.
 */
export function resolveAuthUrl(): string {
  let raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "";

  if (!raw && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    raw = process.env.VERCEL_PROJECT_PRODUCTION_URL.trim();
  }
  if (!raw && process.env.VERCEL_URL) {
    raw = process.env.VERCEL_URL.trim();
  }
  if (!raw) {
    raw = "http://localhost:3000";
  }

  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  try {
    const u = new URL(raw);
    // Strip trailing slash for NextAuth consistency
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}
