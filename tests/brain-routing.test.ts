/**
 * Smart brain routing — pure unit tests (no DB required).
 * Weighted keyword classifier with confidence, fuzzy typo tolerance, and
 * no-silent-default (brain=null on low confidence).
 */
import { describe, it, expect } from "vitest";
import { routeToBrain, CONFIDENCE_THRESHOLD } from "@/lib/ai/brain-router";

describe("smart brain routing", () => {
  it("routes legal questions (incl. judicial review, basic structure, BNS)", () => {
    expect(routeToBrain("article 14").brain).toBe("legal");
    expect(routeToBrain("what is judicial review").brain).toBe("legal");
    expect(routeToBrain("what is basic structure doctrine").brain).toBe("legal");
    expect(routeToBrain("what is bns").brain).toBe("legal");
    expect(routeToBrain("Explain constitutional law").brain).toBe("legal");
  });

  it("routes AllBee questions (incl. alim)", () => {
    expect(routeToBrain("what is allbee solutions").brain).toBe("allbee");
    expect(routeToBrain("who is alim").brain).toBe("allbee");
    expect(routeToBrain("what services does allbee provide").brain).toBe("allbee");
  });

  it("routes Suplaykart questions (incl. revenue, delivery)", () => {
    expect(routeToBrain("what is suplaykart").brain).toBe("suplaykart");
    expect(routeToBrain("suplaykart revenue").brain).toBe("suplaykart");
    expect(routeToBrain("hyperlocal grocery delivery").brain).toBe("suplaykart");
  });

  it("routes personal questions (incl. family members)", () => {
    expect(routeToBrain("who is haji").brain).toBe("haji-core");
    expect(routeToBrain("who is shehnaz nisha").brain).toBe("haji-core");
    expect(routeToBrain("who is safina").brain).toBe("haji-core");
    expect(routeToBrain("who is sahabuddin").brain).toBe("haji-core");
  });

  it("resolves small typos via fuzzy matching", () => {
    expect(routeToBrain("who is hajij").brain).toBe("haji-core");   // hajij~haji
    expect(routeToBrain("who is alimm").brain).toBe("allbee");      // alimm~alim
    expect(routeToBrain("who is safna").brain).toBe("haji-core");   // safna~safina
    expect(routeToBrain("who is hajij").matchedKeywords.some((k) => k.includes("~"))).toBe(true);
  });

  it("returns brain=null (no silent default) when nothing matches", () => {
    expect(routeToBrain("what is computer").brain).toBeNull();
    expect(routeToBrain("give me a random number").brain).toBeNull();
    expect(routeToBrain("what is computer").confidence).toBe(0);
  });

  it("does NOT fuzzy-misroute common words to legal (writ←write, tort←sort)", () => {
    // Red-team regression: "write a poem" previously matched legal keyword "writ".
    expect(routeToBrain("write a poem about the sea").brain).toBeNull();
    expect(routeToBrain("write me an essay").brain).toBeNull();
    expect(routeToBrain("sort these numbers").brain).toBeNull();
    // But an exact legal writ query still routes to legal.
    expect(routeToBrain("what is a writ petition").brain).toBe("legal");
  });

  it("routes named friends/relatives and extra legal terms (recall gaps)", () => {
    expect(routeToBrain("who is azees").brain).toBe("haji-core");
    expect(routeToBrain("who are selva and sundar").brain).toBe("haji-core");
    expect(routeToBrain("what is negligence").brain).toBe("legal");
    expect(routeToBrain("what are directive principles").brain).toBe("legal");
  });

  it("reports confidence, matched keywords, and a reason", () => {
    const r = routeToBrain("what is judicial review");
    expect(r.brain).toBe("legal");
    expect(r.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(r.matchedKeywords.length).toBeGreaterThan(0);
    expect(typeof r.reason).toBe("string");
  });
});
