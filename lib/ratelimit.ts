import { MemoryRateLimiter } from "./ratelimit/memory";
import type { RateLimitResult } from "./ratelimit/types";

export type { RateLimiter, RateLimitResult } from "./ratelimit/types";
export { MemoryRateLimiter } from "./ratelimit/memory";
export { UpstashRateLimiter } from "./ratelimit/upstash";

/**
 * The process-wide limiter. To go multi-instance, swap this for an
 * UpstashRateLimiter (and make callers await — see middleware below).
 */
const limiter = new MemoryRateLimiter();

/** Backward-compatible sync helper (existing callers). */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now?: number,
): RateLimitResult {
  return limiter.check(key, limit, windowMs, now) as RateLimitResult;
}

/** Test helper. */
export function resetRateLimits(): void {
  limiter.reset();
}

/**
 * Shared route middleware: returns a 429 Response when over the limit, or null
 * to continue. Used by all rate-limited API routes for consistent behavior.
 */
export function rateLimitResponse(
  key: string,
  limit: number,
  windowMs: number,
): Response | null {
  const result = rateLimit(key, limit, windowMs);
  if (result.ok) return null;
  return new Response("Too many requests. Please wait.", {
    status: 429,
    headers: {
      "Retry-After": String(Math.ceil((result.retryAfterMs ?? 1000) / 1000)),
    },
  });
}
