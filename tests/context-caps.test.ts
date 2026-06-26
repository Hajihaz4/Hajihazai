import { describe, it, expect } from "vitest";
import { buildMemoryBlock, MEMORY_GUARD } from "@/lib/memory/context-format";

describe("memory block hard char cap (Phase 9.0)", () => {
  it("never exceeds the 1000-char cap", () => {
    const memories = Array.from({ length: 100 }, (_, i) => ({
      content: `Memory item number ${i} with some descriptive content about the user`,
    }));
    const { block, count } = buildMemoryBlock(memories, 100_000, 1000);
    expect(block.length).toBeLessThanOrEqual(1000);
    expect(count).toBeLessThan(100);
  });

  it("still includes the injection guard", () => {
    const { block } = buildMemoryBlock([{ content: "Owns Acme" }], 400, 1000);
    expect(block.startsWith(MEMORY_GUARD)).toBe(true);
  });
});
