/** Retrieval analytics — pure aggregation over event records (no DB). */
import { describe, it, expect } from "vitest";
import {
  aggregateBrainUsage,
  aggregateRetrievalMethods,
  aggregateClarification,
  aggregateZeroResults,
  topDocuments,
  topQueries,
  computeRetrievalAnalytics,
  eventFromMetadata,
  type RetrievalEvent,
} from "@/lib/admin/analytics";

const ev = (o: Partial<RetrievalEvent>): RetrievalEvent => ({
  brainSlug: null, brainMode: "smart", multiBrains: null, confidence: null,
  knowledgeCount: 0, memoryCount: 0, retrievalMethod: "none",
  wasClarify: false, wasZeroResult: false, sources: [], query: "", ...o,
});

describe("retrieval analytics aggregators", () => {
  it("counts brain usage with multi + clarify + none buckets", () => {
    const usage = aggregateBrainUsage([
      ev({ brainSlug: "legal" }), ev({ brainSlug: "legal" }),
      ev({ brainSlug: "allbee" }),
      ev({ multiBrains: ["allbee", "suplaykart"] }),
      ev({ wasClarify: true, brainSlug: null }),
      ev({ brainSlug: null }),
    ]);
    expect(usage[0]).toEqual({ brain: "legal", count: 2 });
    expect(usage.find((u) => u.brain === "multi")?.count).toBe(1);
    expect(usage.find((u) => u.brain === "clarify")?.count).toBe(1);
    expect(usage.find((u) => u.brain === "none")?.count).toBe(1);
  });

  it("splits retrieval methods", () => {
    const m = aggregateRetrievalMethods([
      ev({ retrievalMethod: "semantic" }), ev({ retrievalMethod: "semantic" }),
      ev({ retrievalMethod: "keyword-fallback" }), ev({ retrievalMethod: "none" }),
    ]);
    expect(m).toEqual({ semantic: 2, keywordFallback: 1, none: 1 });
  });

  it("computes clarification count and rate", () => {
    const c = aggregateClarification([ev({ wasClarify: true }), ev({}), ev({}), ev({})]);
    expect(c.count).toBe(1);
    expect(c.rate).toBeCloseTo(0.25);
  });

  it("collects distinct recent zero-result queries (newest-first input)", () => {
    const z = aggregateZeroResults([
      ev({ wasZeroResult: true, query: "obscure thing" }),
      ev({ wasZeroResult: true, query: "Obscure Thing" }), // dup (case-insensitive)
      ev({ wasZeroResult: true, query: "another miss" }),
      ev({ knowledgeCount: 3, query: "a hit" }),
    ]);
    expect(z.count).toBe(3);
    expect(z.recentQueries).toEqual(["obscure thing", "another miss"]);
  });

  it("ranks top documents and queries by frequency", () => {
    const events = [
      ev({ sources: ["Article 21", "Article 14"], query: "what is article 21" }),
      ev({ sources: ["Article 21"], query: "What is Article 21" }),
      ev({ sources: ["AllBee — Founders"], query: "who founded allbee" }),
    ];
    expect(topDocuments(events)[0]).toEqual({ title: "Article 21", count: 2 });
    expect(topQueries(events)[0]).toEqual({ query: "what is article 21", count: 2 });
  });

  it("composes the full analytics object", () => {
    const a = computeRetrievalAnalytics([
      ev({ brainSlug: "legal", retrievalMethod: "semantic", sources: ["Article 21"], query: "article 21", knowledgeCount: 2 }),
      ev({ wasClarify: true, query: "founder" }),
      ev({ wasZeroResult: true, retrievalMethod: "keyword-fallback", query: "xyz" }),
    ]);
    expect(a.totalTurns).toBe(3);
    expect(a.failedRetrievals).toBe(1);
    expect(a.clarification.count).toBe(1);
    expect(a.brainUsage.some((b) => b.brain === "legal")).toBe(true);
  });

  it("parses stored metadata blobs and ignores non-retrieval ones", () => {
    expect(eventFromMetadata({ kind: "retrieval", brainSlug: "legal", knowledgeCount: 2 })?.brainSlug).toBe("legal");
    expect(eventFromMetadata({ kind: "something-else" })).toBeNull();
    expect(eventFromMetadata(null)).toBeNull();
    expect(eventFromMetadata("nope")).toBeNull();
  });

  it("handles an empty event set without throwing", () => {
    const a = computeRetrievalAnalytics([]);
    expect(a.totalTurns).toBe(0);
    expect(a.brainUsage).toEqual([]);
    expect(a.clarification.rate).toBe(0);
  });
});
