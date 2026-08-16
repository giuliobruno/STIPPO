/**
 * Edge-safe rate limit helpers (no Node-only deps).
 * Used by middleware; Node handlers use src/lib/rate-limit.ts (Upstash).
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export function rateLimitSync(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    memoryBuckets.set(key, bucket);
    pruneMemory(now);
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= opts.limit,
    remaining: Math.max(0, opts.limit - bucket.count),
    resetAt: bucket.resetAt,
    limit: opts.limit,
  };
}

function pruneMemory(now: number) {
  if (memoryBuckets.size < MAX_KEYS) return;
  for (const [k, v] of memoryBuckets) {
    if (v.resetAt <= now) memoryBuckets.delete(k);
  }
  if (memoryBuckets.size >= MAX_KEYS) {
    let i = 0;
    for (const k of memoryBuckets.keys()) {
      memoryBuckets.delete(k);
      if (++i > MAX_KEYS / 2) break;
    }
  }
}

/**
 * Prefer platform-provided client IP (Vercel/CF), then X-Forwarded-For.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 1) return parts[0]!;
    return parts[parts.length - 1]!;
  }
  return "unknown";
}
