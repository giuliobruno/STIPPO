/**
 * Rate limiter: Upstash Redis when configured, else in-memory per isolate.
 * Prefer UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in production.
 */

import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    redis = new Redis({ url, token });
  } else {
    redis = null;
  }
  return redis;
}

function memoryLimit(
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

async function redisLimit(
  client: Redis,
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const count = await client.incr(redisKey);
  if (count === 1) {
    await client.pexpire(redisKey, opts.windowMs);
  }
  const pttl = await client.pttl(redisKey);
  const resetAt =
    Date.now() + (pttl > 0 ? pttl : opts.windowMs);
  return {
    ok: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    resetAt,
    limit: opts.limit,
  };
}

/** Async rate limit — use in route handlers. */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): Promise<RateLimitResult> {
  const client = getRedis();
  if (client) {
    try {
      return await redisLimit(client, key, opts);
    } catch (err) {
      console.error("[rate-limit] Upstash error, falling back to memory", err);
    }
  }
  return memoryLimit(key, opts);
}

/**
 * Sync helper for edge middleware (no Upstash REST in Edge without fetch).
 * Uses memory isolate buckets; route handlers still use async Redis.
 */
export function rateLimitSync(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  return memoryLimit(key, opts);
}

/**
 * Prefer platform-provided client IP (Vercel/CF), then right-most
 * X-Forwarded-For hop when a trusted proxy stripped the left.
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
    // Right-most is typically the last trusted proxy's view of the client
    // when the platform appends; fall back to left-most for simple setups.
    if (parts.length === 1) return parts[0]!;
    return parts[parts.length - 1]!;
  }
  return "unknown";
}

export function clientKey(req: Request, suffix: string): string {
  return `${suffix}:${clientIpFromHeaders(req.headers)}`;
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(
      Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
    ),
  };
}

export function tooManyRequests(result: RateLimitResult) {
  return Response.json(
    { error: "Too many requests. Please wait and try again." },
    { status: 429, headers: rateLimitHeaders(result) }
  );
}
