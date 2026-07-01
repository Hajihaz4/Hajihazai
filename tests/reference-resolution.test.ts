/**
 * Phase 3 — conversation reference resolution (pronoun/topic continuity).
 */
import { describe, it, expect } from "vitest";
import { resolveReference, extractEntities } from "@/lib/ai/reference-resolution";

describe("resolveReference", () => {
  it("resolves 'he' to the most recent single entity", () => {
    const r = resolveReference("where does he study?", ["who is haji?"]);
    expect(r.entity).toBe("haji");
    expect(r.resolved).toContain("haji");
  });

  it("resolves across multiple prior turns (most recent single entity wins)", () => {
    const r = resolveReference("what is his role?", ["who is haji?", "tell me about alim"]);
    expect(r.entity).toBe("alim");
  });

  it("resolves 'that company' to a business entity", () => {
    const r = resolveReference("who founded that company?", ["what is allbee solutions?"]);
    expect(r.entity).toBe("allbee");
  });

  it("does not resolve when the message already names an entity", () => {
    const r = resolveReference("where does haji study?", ["who is alim?"]);
    expect(r.entity).toBeNull();
    expect(r.resolved).toBe("where does haji study?");
  });

  it("does not resolve when there is no pronoun/reference", () => {
    const r = resolveReference("what is the weather?", ["who is haji?"]);
    expect(r.entity).toBeNull();
  });

  it("safe fallback: does NOT resolve when the prior turn is ambiguous", () => {
    const r = resolveReference("what does he do?", ["compare haji and alim"]);
    expect(r.entity).toBeNull();
    expect(r.reason).toMatch(/ambiguous/);
  });

  it("safe fallback: no entity in history → no resolution", () => {
    const r = resolveReference("where is it?", ["what is the capital of france?"]);
    expect(r.entity).toBeNull();
  });

  it("extractEntities finds named entities", () => {
    expect(extractEntities("tell me about haji and allbee")).toEqual(
      expect.arrayContaining(["haji", "allbee"]),
    );
    expect(extractEntities("random text")).toEqual([]);
  });
});
