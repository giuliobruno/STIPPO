/**
 * Rate limiter: Upstash Redis when configured, else in-memory per isolate.
 * Prefer UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in production.
 * Node.js route handlers only — middleware uses rate-limit-edge.ts.
 */

import { Redis } from "@upstash/redis";
import {
  clientIpFromHeaders,
  rateLimitSync,
  type RateLimitResult,
} from "@/lib/rate-limit-edge";

export type { RateLimitResult };
export { clientIpFromHeaders, rateLimitSync };

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
  const resetAt = Date.now() + (pttl > 0 ? pttl : opts.windowMs);
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
  return rateLimitSync(key, opts);
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
