/**
 * Minimal in-memory sliding-window rate limiter (no external infra).
 * Keyed per caller; `now` is injectable for deterministic tests.
 *
 * Note: in-memory state is per-process — adequate for guarding expensive
 * routes (e.g. LLM extraction) at MVP scale. Swap for a shared store
 * (e.g. Upstash) when running multi-instance in production.
 */

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - hits[0]) };
  }

  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, remaining: limit - hits.length };
}

/** Test helper — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
