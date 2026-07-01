/**
 * Off-by-one fix — the current user message must always be the final user turn
 * in the prompt, so the assistant answers the CURRENT request (not the previous).
 */
import { describe, it, expect } from "vitest";
import { buildConversationTurns, type HistoryRow } from "@/lib/ai/conversation-turns";
import type { ChatMessage } from "@/lib/ai/types";

const u = (id: string, content: string): HistoryRow => ({ id, role: "user", content });
const a = (id: string, content: string): HistoryRow => ({ id, role: "assistant", content });
const last = (turns: ChatMessage[]) => turns[turns.length - 1];
const userCount = (turns: ChatMessage[], content: string) =>
  turns.filter((t) => t.role === "user" && t.content === content).length;

describe("buildConversationTurns", () => {
  // E — core invariant
  it("E: the last user turn always equals the current request message", () => {
    const history = [u("1", "who is alim"), a("2", "Alim is …")];
    const turns = buildConversationTurns(history, "who is haji", { currentUserMessageId: "u2" });
    expect(last(turns)).toEqual({ role: "user", content: "who is haji" });
  });

  // A — multi-turn: response N answers question N
  it("A: across a 4-message conversation, each turn's final user message is the current question", () => {
    const questions = ["who is alim", "who is haji", "article 14", "article 21"];
    let history: HistoryRow[] = [];
    questions.forEach((q, i) => {
      // Simulate the production race: history does NOT yet contain the current message.
      const turns = buildConversationTurns(history, q, { currentUserMessageId: `u${i}` });
      expect(last(turns)).toEqual({ role: "user", content: q }); // model is asked question N
      // Commit the user message + a stub answer for the next round.
      history = [...history, u(`u${i}`, q), a(`a${i}`, `answer to ${q}`)];
    });
  });

  // A2 — race-won: current message already present in history → must not duplicate
  it("A2: when the read race already included the current message, it is not duplicated", () => {
    const history = [u("1", "who is alim"), a("2", "Alim is …"), u("u2", "who is haji")];
    const turns = buildConversationTurns(history, "who is haji", { currentUserMessageId: "u2" });
    expect(userCount(turns, "who is haji")).toBe(1);
    expect(last(turns)).toEqual({ role: "user", content: "who is haji" });
  });

  // B — first message: empty history, current message must still appear
  it("B: first message (empty history) still appears in the prompt", () => {
    const turns = buildConversationTurns([], "who is alim", { currentUserMessageId: null });
    expect(turns).toEqual([{ role: "user", content: "who is alim" }]);
  });

  // C — regenerate: target user message already in history, no duplicate, not re-appended
  it("C: regenerate does not duplicate the current user turn", () => {
    // On regenerate, addMessage was NOT called (currentUserMessageId null) and the
    // user message is already the last turn in history (its assistant reply was deleted).
    const history = [u("1", "who is haji")];
    const turns = buildConversationTurns(history, "who is haji", {
      regenerate: true,
      currentUserMessageId: null,
    });
    expect(userCount(turns, "who is haji")).toBe(1);
    expect(last(turns)).toEqual({ role: "user", content: "who is haji" });
  });

  // C2 — regenerate with LATER turns still in the window (summarization case):
  // the target must become the final turn (drop trailing turns).
  it("C2: regenerate makes the target the final turn even when later turns remain", () => {
    const history = [
      u("1", "who is haji"),
      a("2", "Haji is …"),
      u("3", "who is alim"), // regenerate target
      a("4", "Alim is …"),
      u("5", "what is allbee"),
      a("6", "AllBee is …"),
    ];
    const turns = buildConversationTurns(history, "who is alim", {
      regenerate: true,
      currentUserMessageId: null,
    });
    expect(last(turns)).toEqual({ role: "user", content: "who is alim" });
    // Nothing after the target should remain.
    expect(turns.some((t) => t.content === "what is allbee")).toBe(false);
  });

  // C3 — regenerate target scrolled out of the window → append so it's answered.
  it("C3: regenerate appends the target when it is not in the window", () => {
    const history = [u("9", "later question"), a("10", "later answer")];
    const turns = buildConversationTurns(history, "old regenerated question", {
      regenerate: true,
      currentUserMessageId: null,
    });
    expect(last(turns)).toEqual({ role: "user", content: "old regenerated question" });
  });

  // D — debug behaves identically to non-debug
  it("D: debug and non-debug produce the same final turns", () => {
    const history = [u("1", "who is alim"), a("2", "Alim is …")];
    // non-debug: addMessage ran → currentUserMessageId set
    const nonDebug = buildConversationTurns(history, "who is haji", { currentUserMessageId: "u2" });
    // debug: addMessage NOT called → currentUserMessageId null
    const debug = buildConversationTurns(history, "who is haji", { currentUserMessageId: null });
    expect(debug).toEqual(nonDebug);
    expect(last(debug)).toEqual({ role: "user", content: "who is haji" });
  });

  it("trims the appended current message", () => {
    const turns = buildConversationTurns([], "  hello  ", {});
    expect(last(turns)).toEqual({ role: "user", content: "hello" });
  });

  it("preserves prior turns and chronological order", () => {
    const history = [u("1", "q1"), a("2", "a1")];
    const turns = buildConversationTurns(history, "q2", { currentUserMessageId: "u2" });
    expect(turns).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ]);
  });
});
