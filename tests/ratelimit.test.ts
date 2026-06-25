import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimits } from "@/lib/ratelimit";

describe("rate limiter", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k", 5, 60_000, now).ok).toBe(true);
    }
    const blocked = rateLimit("k", 5, 60_000, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window passes", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) rateLimit("k2", 5, 60_000, now);
    expect(rateLimit("k2", 5, 60_000, now).ok).toBe(false);
    expect(rateLimit("k2", 5, 60_000, now + 60_001).ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const now = 1000;
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000, now);
    expect(rateLimit("b", 5, 60_000, now).ok).toBe(true);
  });
});
