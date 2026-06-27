import { describe, it, expect } from "vitest";
import { listHealthyLevels, resolveLevel } from "@/lib/ai/levels";
import { isAdmin } from "@/lib/auth/admin";

describe("capability levels", () => {
  it("shows all four levels when every primary is healthy", () => {
    const got = listHealthyLevels(() => true).map((l) => l.level);
    expect(got).toEqual(["low", "medium", "high", "max"]);
  });

  it("hides levels whose primary is unhealthy (production scenario)", () => {
    // Only the two working models are usable (Llama 3.3, Qwen 2.5 7B).
    const healthy = new Set(["groq:llama-3.3-70b", "openrouter:qwen-2.5-7b"]);
    const got = listHealthyLevels((id) => healthy.has(id)).map((l) => l.level);
    // low → qwen-2.5-7b, medium → llama-3.3-70b; high/max primaries are down.
    expect(got).toEqual(["low", "medium"]);
  });

  it("remaps an unhealthy level down its chain to a healthy model", () => {
    const healthy = new Set(["groq:llama-3.3-70b", "openrouter:qwen-2.5-7b"]);
    const usable = (id: string) => healthy.has(id);
    expect(resolveLevel("high", usable)).toBe("groq:llama-3.3-70b");
    expect(resolveLevel("max", usable)).toBe("groq:llama-3.3-70b");
    expect(resolveLevel("low", usable)).toBe("openrouter:qwen-2.5-7b");
  });

  it("returns null when nothing in the chain is usable", () => {
    expect(resolveLevel("low", () => false)).toBeNull();
  });
});

describe("admin gate", () => {
  it("matches ADMIN_EMAILS case-insensitively", () => {
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = "Owner@Example.com, two@x.com";
    try {
      expect(isAdmin("owner@example.com")).toBe(true);
      expect(isAdmin("two@x.com")).toBe(true);
      expect(isAdmin("nope@x.com")).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
      expect(isAdmin(null)).toBe(false);
    } finally {
      if (prev !== undefined) process.env.ADMIN_EMAILS = prev;
      else delete process.env.ADMIN_EMAILS;
    }
  });

  it("denies everyone when ADMIN_EMAILS is unset", () => {
    const prev = process.env.ADMIN_EMAILS;
    delete process.env.ADMIN_EMAILS;
    try {
      expect(isAdmin("anyone@x.com")).toBe(false);
    } finally {
      if (prev !== undefined) process.env.ADMIN_EMAILS = prev;
    }
  });
});
