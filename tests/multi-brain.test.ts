/** Phase 4 — multi-brain scope detection. */
import { describe, it, expect } from "vitest";
import { detectMultiBrainScope } from "@/lib/ai/multi-brain";

describe("detectMultiBrainScope", () => {
  it("spans both business brains for a comparison", () => {
    expect(detectMultiBrainScope("compare allbee and suplaykart").sort()).toEqual(["allbee", "suplaykart"]);
  });

  it("spans business brains for 'what businesses does haji own'", () => {
    const b = detectMultiBrainScope("what businesses does haji own");
    expect(b).toContain("allbee");
    expect(b).toContain("suplaykart");
  });

  it("spans haji-core + allbee for 'what connects haji and alim'", () => {
    expect(detectMultiBrainScope("what connects haji and alim").sort()).toEqual(["allbee", "haji-core"]);
  });

  it("returns [] for single-brain queries", () => {
    expect(detectMultiBrainScope("who is haji")).toEqual([]);
    expect(detectMultiBrainScope("what is allbee solutions")).toEqual([]);
    expect(detectMultiBrainScope("article 21")).toEqual([]);
  });

  it("never auto-includes the legal brain (isolation)", () => {
    // even if a legal-ish entity co-occurred, legal is excluded from multi merge
    const b = detectMultiBrainScope("compare allbee and suplaykart law");
    expect(b).not.toContain("legal");
  });
});
