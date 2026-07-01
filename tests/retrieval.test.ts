import { describe, it, expect } from "vitest";
import {
  typeWeight,
  scoreMemory,
  matchesQuery,
  rankMemories,
  significantTokens,
} from "@/lib/memory/ranking";

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

describe("retrieval ranking & search", () => {
  it("orders type importance preference > identity > fact > note", () => {
    expect(typeWeight("preference")).toBeGreaterThan(typeWeight("identity"));
    expect(typeWeight("identity")).toBeGreaterThan(typeWeight("fact"));
    expect(typeWeight("fact")).toBeGreaterThan(typeWeight("note"));
  });

  it("raises score for more recent memories of the same type", () => {
    expect(scoreMemory({ type: "note", updatedAt: NOW - DAY }, NOW)).toBeGreaterThan(
      scoreMemory({ type: "note", updatedAt: NOW - 100 * DAY }, NOW),
    );
  });

  it("lets type importance dominate recency", () => {
    expect(
      scoreMemory({ type: "preference", updatedAt: NOW - 100 * DAY }, NOW),
    ).toBeGreaterThan(scoreMemory({ type: "note", updatedAt: NOW }, NOW));
  });

  it("matches keywords case-insensitively (brand tokens)", () => {
    expect(matchesQuery("Founder of Suplaykart", "suplaykart")).toBe(true);
    expect(matchesQuery("Uses AllBee Solutions", "allbee")).toBe(true);
    expect(matchesQuery("Banks with LLB", "LLB")).toBe(true);
    expect(matchesQuery("Likes coffee", "Suplaykart")).toBe(false);
    expect(matchesQuery("anything", "")).toBe(true);
  });

  it("matches natural-language questions on content words (with plural fold)", () => {
    // "goals" (query) folds to "goal" (memory); "haji" + filler are ignored.
    expect(matchesQuery("Five-year goal: become a lawyer", "what are haji's goals")).toBe(true);
    expect(matchesQuery("Not currently in a romantic relationship", "is haji in a relationship")).toBe(true);
    expect(matchesQuery("Hobbies: football and cricket", "what are his hobbies")).toBe(true);
    // A query of only stopwords/"haji" must NOT match everything (no dumping).
    expect(matchesQuery("Full name is Syed", "who is haji")).toBe(false);
    // Unrelated question still doesn't match.
    expect(matchesQuery("Favorite car is Lexus", "tell me a joke")).toBe(false);
  });

  it("significantTokens drops stopwords and the ubiquitous 'haji' token", () => {
    expect(significantTokens("what are haji's goals")).toEqual(["goals"]);
    expect(significantTokens("who is haji")).toEqual([]);
  });

  it("ranks then filters via rankMemories", () => {
    const items = [
      { id: "n", type: "note", content: "Likes coffee", updatedAt: new Date(NOW) },
      {
        id: "p",
        type: "preference",
        content: "Prefers concise answers",
        updatedAt: new Date(NOW - 50 * DAY),
      },
      {
        id: "i",
        type: "identity",
        content: "Founder of Suplaykart",
        updatedAt: new Date(NOW - 10 * DAY),
      },
    ];
    expect(rankMemories(items, undefined, NOW).map((r) => r.id)).toEqual([
      "p",
      "i",
      "n",
    ]);
    expect(rankMemories(items, "suplaykart", NOW).map((r) => r.id)).toEqual(["i"]);
  });
});
