import type { RateLimiter, RateLimitResult } from "./types";

/**
 * Placeholder for a shared, multi-instance rate limiter (e.g. Upstash Redis).
 * NOT integrated in Phase 9.0 — this only documents the seam so swapping the
 * global limiter is a one-line change in lib/ratelimit.ts.
 *
 * A real implementation would use a Redis sliding-window / token-bucket script
 * and return a Promise<RateLimitResult>.
 */
export class UpstashRateLimiter implements RateLimiter {
  check(): Promise<RateLimitResult> {
    return Promise.reject(
      new Error("UpstashRateLimiter is not implemented (Phase 9.0 stub)."),
    );
  }
  reset(): void {}
}
