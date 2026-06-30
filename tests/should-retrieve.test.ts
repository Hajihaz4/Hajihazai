import { describe, it, expect } from "vitest";
import { shouldRetrieve } from "@/lib/ai/should-retrieve";
import { tokenize } from "@/lib/knowledge/keyword-search";

describe("shouldRetrieve — greeting / low-info gate", () => {
  const BYPASS = [
    "hi", "Hi", "hii", "hello", "hey", "heyy", "yo", "sup", "what's up", "whats up",
    "good morning", "Good Evening", "good night", "how are you", "how are you doing",
    "how's it going", "thanks", "Thanks!", "thank you", "thank u", "thx", "ty",
    "cheers", "ok", "okay", "k", "cool", "nice", "great", "awesome", "fine", "sure",
    "got it", "yep", "yes", "no", "lol", "haha", "hmm", "bye", "see you",
  ];
  for (const m of BYPASS) {
    it(`bypasses retrieval for "${m}"`, () => {
      expect(shouldRetrieve(m)).toBe(false);
    });
  }

  const RETRIEVE = [
    "who is haji",
    "what is suplaykart",
    "hi, who is haji?",
    "tell me about my goals",
    "what does the Companies Act say",
    "hey can you explain my business plan", // >40 chars
    "remember my meeting tomorrow",
  ];
  for (const m of RETRIEVE) {
    it(`retrieves for "${m}"`, () => {
      expect(shouldRetrieve(m)).toBe(true);
    });
  }

  it("ignores empty / whitespace", () => {
    expect(shouldRetrieve("")).toBe(false);
    expect(shouldRetrieve("   ")).toBe(false);
  });
});

describe("tokenize — min length 3 (no 2-char substring noise)", () => {
  it("drops 2-char tokens that caused broad %xx% matches", () => {
    expect(tokenize("hi")).toEqual([]);
    expect(tokenize("ok")).toEqual([]);
    expect(tokenize("yo")).toEqual([]);
  });
  it("keeps meaningful terms", () => {
    expect(tokenize("suplaykart")).toEqual(["suplaykart"]);
    expect(tokenize("good morning")).toEqual(["good", "morning"]);
    expect(tokenize("Companies Act 2013")).toContain("companies");
    expect(tokenize("Companies Act 2013")).toContain("2013");
  });
  it("drops stopwords", () => {
    expect(tokenize("how are you")).toEqual([]);
  });
});
