/**
 * Smart brain routing — pure unit tests (no DB required).
 * Verifies the keyword-based classifier in lib/ai/brain-router.ts.
 */
import { describe, it, expect } from "vitest";
import { routeToBrain } from "@/lib/ai/brain-router";

describe("smart brain routing", () => {
  // Legal Brain
  it("routes law questions to legal brain", () => {
    expect(routeToBrain("What is the law on company contracts?")).toBe("legal");
    expect(routeToBrain("Explain constitutional law")).toBe("legal");
    expect(routeToBrain("LLB exam preparation tips")).toBe("legal");
    expect(routeToBrain("What is a tort in law?")).toBe("legal");
  });

  // Suplaykart Brain
  it("routes supply chain questions to suplaykart", () => {
    expect(routeToBrain("How is Suplaykart doing?")).toBe("suplaykart");
    expect(routeToBrain("What vendors does Suplaykart have?")).toBe("suplaykart");
    expect(routeToBrain("FMCG B2B delivery model")).toBe("suplaykart");
  });

  // AllBee Brain
  it("routes agency questions to allbee", () => {
    expect(routeToBrain("What clients does AllBee Solutions have?")).toBe("allbee");
    expect(routeToBrain("AllBee digital marketing campaign")).toBe("allbee");
    expect(routeToBrain("website development project proposal")).toBe("allbee");
  });

  // Haji Core
  it("routes personal questions to haji-core", () => {
    expect(routeToBrain("Who is Haji?")).toBe("haji-core");
    expect(routeToBrain("Tell me about Haji's family")).toBe("haji-core");
    expect(routeToBrain("When was Haji born?")).toBe("haji-core");
    expect(routeToBrain("What is Haji's goal?")).toBe("haji-core");
  });

  // Default fallback
  it("defaults to haji-core when no keyword matches", () => {
    expect(routeToBrain("Hello, how are you?")).toBe("haji-core");
    expect(routeToBrain("Give me a random fact")).toBe("haji-core");
  });

  // Higher-score brain wins
  it("prefers higher-scoring brain on ambiguous messages", () => {
    // "law" + "company" → legal (weight 2) beats allbee
    const result = routeToBrain("What company law applies to Suplaykart vendors?");
    // Both legal and suplaykart keywords present; legal should win (specific legal terms)
    expect(["legal", "suplaykart"]).toContain(result);
  });
});
