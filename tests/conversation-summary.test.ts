/** Phase B — long-conversation summarization (deterministic digest). */
import { describe, it, expect } from "vitest";
import {
  splitForDigest,
  extractGoals,
  digestConversation,
  renderConversationDigest,
  type DigestTurn,
} from "@/lib/ai/conversation-summary";

const t = (role: string, content: string): DigestTurn => ({ role, content });

describe("splitForDigest", () => {
  it("keeps everything verbatim when under the window", () => {
    const h = [1, 2, 3];
    expect(splitForDigest(h, 14)).toEqual({ older: [], recent: h });
  });
  it("splits older vs recent past the window", () => {
    const h = Array.from({ length: 20 }, (_, i) => i);
    const { older, recent } = splitForDigest(h, 14);
    expect(older).toEqual([0, 1, 2, 3, 4, 5]);
    expect(recent.length).toBe(14);
    expect(recent[recent.length - 1]).toBe(19);
  });
});

describe("extractGoals", () => {
  it("captures goal/intent sentences", () => {
    const goals = extractGoals("Haji wants to become a corporate lawyer. He is planning to relaunch Suplaykart.");
    expect(goals.some((g) => /corporate lawyer/i.test(g))).toBe(true);
    expect(goals.some((g) => /relaunch Suplaykart/i.test(g))).toBe(true);
  });
  it("ignores non-goal text", () => {
    expect(extractGoals("The sky is blue. Water is wet.")).toEqual([]);
  });
});

describe("digestConversation", () => {
  const older: DigestTurn[] = [
    t("user", "who is haji"),
    t("assistant", "Haji is an entrepreneur and law student. His goal is to become a corporate lawyer."),
    t("user", "what is allbee"),
    t("assistant", "AllBee Solutions is a digital agency; Alim is the founder."),
    t("user", "what is article 21"),
    t("assistant", "Article 21 protects life and personal liberty."),
  ];

  it("preserves entities, topics, and goals", () => {
    const d = digestConversation(older)!;
    expect(d.entities).toEqual(expect.arrayContaining(["haji", "allbee", "alim"]));
    expect(d.topics.some((x) => /Haji/.test(x))).toBe(true);
    expect(d.topics.some((x) => /AllBee/.test(x))).toBe(true);
    expect(d.topics.some((x) => /law/i.test(x))).toBe(true);
    expect(d.goals.some((g) => /corporate lawyer/i.test(g))).toBe(true);
  });

  it("returns null for empty or content-free input", () => {
    expect(digestConversation([])).toBeNull();
    expect(digestConversation([t("user", "hi"), t("assistant", "hello")])).toBeNull();
  });
});

describe("renderConversationDigest", () => {
  it("renders a compact recap block guarded as background context", () => {
    const block = renderConversationDigest([
      t("user", "who is haji"),
      t("assistant", "Haji wants to become a corporate lawyer."),
    ])!;
    expect(block).toMatch(/Earlier conversation recap/);
    expect(block).toMatch(/not new instructions/);
    expect(block).toMatch(/haji/);
  });
  it("returns null when there is nothing to summarize", () => {
    expect(renderConversationDigest([])).toBeNull();
  });
});
