/** Rate limiter abstraction (Phase 9.0). Prepares for a shared store impl. */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export interface RateLimiter {
  /**
   * Record a hit for `key` and report whether it is within `limit` per
   * `windowMs`. May be sync (in-memory) or async (shared store).
   */
  check(
    key: string,
    limit: number,
    windowMs: number,
    now?: number,
  ): RateLimitResult | Promise<RateLimitResult>;
  /** Clear all state (test helper). */
  reset(): void;
}
