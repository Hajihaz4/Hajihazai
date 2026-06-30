import type { ChatMessage, ChatRole } from "./types";

/** A persisted message row, as returned by listRecentMessages(). */
export interface HistoryRow {
  id: string;
  role: ChatRole;
  content: string;
}

/**
 * Build the ordered conversation turns for the LLM prompt.
 *
 * Guarantees the CURRENT user message is the final user turn. This fixes the
 * off-by-one bug where listRecentMessages() (read) raced addMessage() (write of
 * the current message) and the prompt's last turn was the PREVIOUS message, so
 * the model answered the previous request.
 *
 * Rules:
 *  - Drop the just-added current user message if the read race already included
 *    it (so it is never duplicated).
 *  - Always append the current message as the final user turn …
 *  - … EXCEPT on regenerate, where addMessage() was not called and the target
 *    user message is already the last turn in history (appending would duplicate).
 *
 * Note: there is intentionally no `debug` branch — debug and non-debug now
 * assemble turns identically (debug only differs in whether addMessage() ran,
 * i.e. whether currentUserMessageId is set).
 */
export function buildConversationTurns(
  history: HistoryRow[],
  currentMessage: string,
  opts: { regenerate?: boolean; currentUserMessageId?: string | null } = {},
): ChatMessage[] {
  const turns: ChatMessage[] = history
    .filter((m) => m.id !== opts.currentUserMessageId)
    .map((m) => ({ role: m.role, content: m.content }));

  if (!opts.regenerate) {
    turns.push({ role: "user", content: currentMessage.trim() });
  }

  return turns;
}
