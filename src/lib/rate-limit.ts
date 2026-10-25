import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

const WINDOW_MS = 1_000;
const MAX_REQUESTS = 1; // PRD 2.3 step 2: more than 1 request / second -> 429

let upstash: Ratelimit | null | undefined;

function getUpstash(): Ratelimit | null {
  if (upstash !== undefined) return upstash;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  upstash = url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "1 s"),
        prefix: "paintcode:rl",
      })
    : null;
  return upstash;
}

// Fallback for local development / single-instance deployments.
const memoryHits = new Map<string, number[]>();

function memoryLimit(key: string): RateLimitResult {
  const now = Date.now();
  const recent = (memoryHits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    memoryHits.set(key, recent);
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - recent[0]) };
  }
  recent.push(now);
  memoryHits.set(key, recent);
  if (memoryHits.size > 10_000) {
    for (const [k, hits] of memoryHits) if (hits.every((t) => now - t >= WINDOW_MS)) memoryHits.delete(k);
  }
  return { allowed: true, retryAfterMs: 0 };
}

export async function checkLookupRateLimit(userId: string): Promise<RateLimitResult> {
  const key = `lookup:${userId}`;
  const limiter = getUpstash();
  if (!limiter) return memoryLimit(key);
  try {
    const result = await limiter.limit(key);
    return { allowed: result.success, retryAfterMs: Math.max(0, result.reset - Date.now()) };
  } catch {
    // Redis outage must not take lookups down; the DB row lock still protects credits.
    return memoryLimit(key);
  }
}
