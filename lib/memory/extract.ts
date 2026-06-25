import { routeChat } from "@/lib/ai/router";
import { getConversation, listMessages } from "@/lib/db/queries";
import { createMemory, existingMemoryContents } from "@/lib/db/memory-queries";
import { parseCandidates } from "./parse-candidates";

const EXTRACTION_SYSTEM = [
  "You extract durable, long-term memories about the USER from a conversation.",
  'Output ONLY a JSON array, no prose. Each element must be {"type": one of ["preference","fact","identity","goal","note"], "content": "<short factual statement about the user>"}.',
  "Only include stable facts or preferences worth remembering long-term.",
  "Ignore greetings and transient chatter. If nothing is worth remembering, output [].",
].join(" ");

/**
 * Manual extraction: read a conversation, ask the model for candidate
 * memories, and store survivors as PENDING. Never auto-activates.
 * Does not touch chat responses, retrieval, or prompt injection.
 */
export async function extractMemories(userId: string, conversationId: string) {
  const convo = await getConversation(userId, conversationId);
  if (!convo) {
    return { conversationId, created: [], reason: "not_found" as const };
  }

  const history = await listMessages(conversationId);
  if (history.length === 0) {
    return { conversationId, created: [], reason: "empty" as const };
  }

  const transcript = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await routeChat([
    { role: "system", content: EXTRACTION_SYSTEM },
    { role: "user", content: transcript },
  ]);

  const candidates = parseCandidates(result.text);

  // Dedupe against the user's existing (non-deleted) memories.
  const seen = await existingMemoryContents(userId);

  const created = [];
  for (const c of candidates) {
    const key = c.content.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const row = await createMemory(userId, {
      type: c.type,
      content: c.content,
      status: "pending",
    });
    created.push(row);
  }

  return { conversationId, created, reason: "ok" as const };
}
