// No "server-only" here: proxy.ts (the edge of the app) imports this too.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

const WINDOW_MS = 1_000;
// PRD 2.3 step 2: more than 1 paid lookup / second -> 429 (checked in the lookup service).
const LOOKUP_MAX = 1;
// PRD 4.1: a looser burst guard in proxy.ts stops request floods before they reach the database.
const EDGE_BURST_MAX = 5;

const upstash = new Map<string, Ratelimit | null>();

function getUpstash(name: string, max: number): Ratelimit | null {
  if (upstash.has(name)) return upstash.get(name)!;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const limiter =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(max, "1 s"),
          prefix: `paintcode:rl:${name}`,
        })
      : null;
  upstash.set(name, limiter);
  return limiter;
}

// Fallback for local development / single-instance deployments.
const memoryHits = new Map<string, number[]>();

function memoryLimit(key: string, max: number): RateLimitResult {
  const now = Date.now();
  const recent = (memoryHits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= max) {
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

async function rateLimit(name: string, max: number, key: string): Promise<RateLimitResult> {
  const limiter = getUpstash(name, max);
  if (!limiter) return memoryLimit(`${name}:${key}`, max);
  try {
    const result = await limiter.limit(key);
    return { allowed: result.success, retryAfterMs: Math.max(0, result.reset - Date.now()) };
  } catch {
    // Redis outage must not take lookups down; the DB row lock still protects credits.
    return memoryLimit(`${name}:${key}`, max);
  }
}

export function checkLookupRateLimit(userId: string): Promise<RateLimitResult> {
  return rateLimit("lookup", LOOKUP_MAX, userId);
}

/** Burst guard for POST /api/lookup, keyed by user id (or IP when signed out). */
export function checkEdgeBurstLimit(key: string): Promise<RateLimitResult> {
  return rateLimit("edge", EDGE_BURST_MAX, key);
}
