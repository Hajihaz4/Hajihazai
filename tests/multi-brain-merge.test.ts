/**
 * Red-team regression (Phase 4) — multi-brain merge must not duplicate context.
 *
 * A brain's retrieval scope includes NULL-brain (unassigned/global) documents, so
 * the same chunk can appear in several brains' per-brain results. mergeBrainChunks
 * must dedup by chunkId so a shared document is never rendered/counted twice.
 */
import { describe, it, expect } from "vitest";
import { mergeBrainChunks, buildKnowledgeBlock } from "@/lib/memory/context";

const hit = (chunkId: string, documentId: string, title: string, content: string) => ({
  chunkId, documentId, title, content, similarity: 0,
});

describe("mergeBrainChunks", () => {
  it("dedups a shared (null-brain) chunk that appears in every brain's result", () => {
    // "shared" is the same chunkId returned by all three brains (null brain_id).
    const shared = hit("c-shared", "d-shared", "Haji Core Profile", "shared content");
    const results = [
      { chunks: [hit("c-hc", "d-hc", "Haji Core", "hc"), shared] },       // haji-core
      { chunks: [shared, hit("c-ab", "d-ab", "AllBee Overview", "ab")] }, // allbee
      { chunks: [shared, hit("c-sk", "d-sk", "Suplaykart Overview", "sk")] }, // suplaykart
    ];
    const merged = mergeBrainChunks(results);
    const sharedCount = merged.filter((c) => c.chunkId === "c-shared").length;
    expect(sharedCount).toBe(1);
    expect(merged.map((c) => c.chunkId)).toEqual(["c-hc", "c-shared", "c-ab", "c-sk"]);
  });

  it("preserves first-seen order and distinct chunks", () => {
    const merged = mergeBrainChunks([
      { chunks: [hit("a", "da", "A", "a")] },
      { chunks: [hit("b", "db", "B", "b")] },
    ]);
    expect(merged.map((c) => c.chunkId)).toEqual(["a", "b"]);
  });

  it("rendered block contains a duplicated document only once", () => {
    const shared = hit("c-shared", "d-shared", "Haji Core Profile", "shared content");
    const merged = mergeBrainChunks([{ chunks: [shared] }, { chunks: [shared] }]);
    const { block, count } = buildKnowledgeBlock(merged);
    // Document header must appear exactly once, count must be 1 (not 2).
    expect(block.match(/\[Document: Haji Core Profile\]/g)?.length).toBe(1);
    expect(count).toBe(1);
  });

  it("handles empty results", () => {
    expect(mergeBrainChunks([])).toEqual([]);
    expect(mergeBrainChunks([{ chunks: [] }])).toEqual([]);
  });
});
