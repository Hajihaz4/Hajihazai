import { describe, it, expect } from "vitest";
import { chunkDocument, CHUNK_SIZE, CHUNK_OVERLAP } from "@/lib/knowledge/chunk";

describe("chunkDocument (pure)", () => {
  it("uses 1000-char chunks with 200-char overlap", () => {
    expect(CHUNK_SIZE).toBe(1000);
    expect(CHUNK_OVERLAP).toBe(200);

    const text = "x".repeat(2500);
    const chunks = chunkDocument(text);
    // step = size - overlap = 800. Windows start at 0, 800, 1600; the window
    // at 1600 reaches the end (1600+1000 >= 2500), so 3 chunks total.
    expect(chunks.length).toBe(3);
    expect(chunks[0].content.length).toBe(1000);
    expect(chunks[1].content.length).toBe(1000);
    expect(chunks[2].content.length).toBe(900); // 2500 - 1600
  });

  it("preserves order via ascending chunkIndex", () => {
    const text = "y".repeat(3000);
    const chunks = chunkDocument(text);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("produces correct overlap between consecutive chunks", () => {
    // Distinct characters so overlap is verifiable.
    const text = Array.from({ length: 1200 }, (_, i) =>
      String.fromCharCode(33 + (i % 90)),
    ).join("");
    const chunks = chunkDocument(text);
    // chunk0 = [0,1000), chunk1 = [800, 1200)
    const tailOfFirst = chunks[0].content.slice(800); // last 200 chars
    const headOfSecond = chunks[1].content.slice(0, 200); // first 200 chars
    expect(headOfSecond).toBe(tailOfFirst);
  });

  it("returns a single chunk for short content", () => {
    const chunks = chunkDocument("short text");
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe("short text");
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("returns no chunks for empty/whitespace content", () => {
    expect(chunkDocument("")).toEqual([]);
    expect(chunkDocument("   \n  ")).toEqual([]);
  });

  it("reconstructs the original text from non-overlapping prefixes", () => {
    const text = "z".repeat(2200) + "END";
    const chunks = chunkDocument(text);
    // Last chunk must contain the final characters.
    expect(chunks[chunks.length - 1].content.endsWith("END")).toBe(true);
  });
});
