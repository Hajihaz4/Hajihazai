import type { RateLimiter, RateLimitResult } from "./types";

/**
 * In-memory sliding-window limiter. Per-process — adequate for a single
 * instance / MVP. NOT shared across Vercel instances (see UpstashRateLimiter).
 */
export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, number[]>();

  check(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
  ): RateLimitResult {
    const hits = (this.buckets.get(key) ?? []).filter((t) => now - t < windowMs);
    if (hits.length >= limit) {
      this.buckets.set(key, hits);
      return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - hits[0]) };
    }
    hits.push(now);
    this.buckets.set(key, hits);
    return { ok: true, remaining: limit - hits.length };
  }

  reset(): void {
    this.buckets.clear();
  }
}
