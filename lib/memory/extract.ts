import { routeChat } from "@/lib/ai/router";
import { getConversation, listMessages } from "@/lib/db/queries";
import { createMemory, existingMemoryContents } from "@/lib/db/memory-queries";
import { analyzeExtraction, type Diagnostics } from "./parse-candidates";

const EXTRACTION_SYSTEM = [
  "You extract durable, long-term memories about the USER from a conversation.",
  "Return ONLY JSON: an object {\"memories\": [ ... ]}.",
  "Each memory is { type, content, durable }:",
  "- type: one of preference | fact | identity | goal | note.",
  "- content: a short, self-contained statement in third person about the user",
  "  (e.g. 'Prefers concise answers', 'Runs a coffee business called BeanWorks', 'Lives in Dubai').",
  "- durable: true if stable and worth remembering long-term; false if temporary or about the current moment",
  "  (e.g. 'is tired right now', 'is currently debugging', 'wants coffee today').",
  "Capture user preferences, business facts, and personal profile facts.",
  "Mark temporary/momentary statements durable=false. Never invent information.",
  "",
  "Example conversation:",
  "user: I'm Sam, I run a bakery called Loafly in Berlin. I like short answers. I'm exhausted today.",
  'Example output: {"memories":[',
  '{"type":"identity","content":"Name is Sam","durable":true},',
  '{"type":"fact","content":"Runs a bakery called Loafly in Berlin","durable":true},',
  '{"type":"preference","content":"Prefers short answers","durable":true},',
  '{"type":"note","content":"Is exhausted today","durable":false}]}',
].join("\n");

// Structured-output schema enforced at the provider level.
export const EXTRACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["preference", "fact", "identity", "goal", "note"],
          },
          content: { type: "string" },
          durable: { type: "boolean" },
        },
        required: ["type", "content", "durable"],
      },
    },
  },
  required: ["memories"],
};

export interface ExtractionResult {
  conversationId: string;
  reason: "ok" | "not_found" | "empty";
  model?: string;
  diagnostics: Diagnostics | null;
  created: Awaited<ReturnType<typeof createMemory>>[];
}

/**
 * Run extraction. In preview mode nothing is persisted — only diagnostics are
 * returned. Otherwise accepted candidates are stored as PENDING.
 */
export async function extractMemories(
  userId: string,
  conversationId: string,
  opts: { preview?: boolean } = {},
): Promise<ExtractionResult> {
  const convo = await getConversation(userId, conversationId);
  if (!convo) {
    return { conversationId, reason: "not_found", diagnostics: null, created: [] };
  }

  const history = await listMessages(conversationId);
  if (history.length === 0) {
    return {
      conversationId,
      reason: "empty",
      diagnostics: { rawOutput: "", malformed: false, parsed: [], accepted: [], rejected: [] },
      created: [],
    };
  }

  const transcript = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const result = await routeChat(
    [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: transcript },
    ],
    { jsonSchema: EXTRACTION_SCHEMA },
  );

  const existing = await existingMemoryContents(userId);
  const diagnostics = analyzeExtraction(result.text, existing);

  const created: Awaited<ReturnType<typeof createMemory>>[] = [];
  if (!opts.preview) {
    for (const c of diagnostics.accepted) {
      const row = await createMemory(userId, {
        type: c.type,
        content: c.content,
        status: "pending",
      });
      created.push(row);
    }
  }

  return {
    conversationId,
    reason: "ok",
    model: result.modelId,
    diagnostics,
    created,
  };
}
