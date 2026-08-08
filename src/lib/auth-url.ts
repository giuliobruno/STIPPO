/**
 * Resolve a valid absolute origin for NextAuth / redirects.
 * Accepts bare domains (stippo.app) and fills https:// when needed.
 *
 * Prefer the public host users actually hit (e.g. www) when apex redirects.
 */
export function resolveAuthUrl(): string {
  let raw =
    process.env.NEXTAUTH_URL?.trim().replace(/^["']|["']$/g, "") ||
    process.env.AUTH_URL?.trim().replace(/^["']|["']$/g, "") ||
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
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}
