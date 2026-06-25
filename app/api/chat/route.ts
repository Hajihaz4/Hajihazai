import { auth } from "@/auth";
import {
  addMessage,
  getConversation,
  listMessages,
  setConversationTitle,
} from "@/lib/db/queries";
import { HAJI_PERSONA } from "@/lib/ai/persona";
import { routeChat } from "@/lib/ai/router";
import {
  buildMemoryContext,
  buildKnowledgeContext,
} from "@/lib/memory/context";
import { selectAndRunTool } from "@/lib/tools/tool-calling";
import type { ChatMessage } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const debug =
    ["1", "true"].includes(new URL(req.url).searchParams.get("debug") ?? "");

  const { conversationId, message, modelId } = await req.json();
  if (!conversationId || typeof message !== "string" || !message.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  // Ownership guard — the conversation must belong to the signed-in user.
  const convo = await getConversation(session.user.id, conversationId);
  if (!convo) {
    return new Response("Not found", { status: 404 });
  }

  // 1. Persist the user's message (skipped in debug to avoid side effects).
  if (!debug) {
    await addMessage({ conversationId, role: "user", content: message });
  }

  // 2. Build memory + knowledge context via semantic retrieval on the message.
  const memory = await buildMemoryContext(session.user.id, { query: message });
  const knowledge = await buildKnowledgeContext(session.user.id, {
    query: message,
  });

  // 3. Single tool-calling step (at most ONE tool executed, 10s timeout).
  const tool = await selectAndRunTool(session.user.id, message);
  const toolBlock =
    tool.toolExecuted && tool.toolResult != null
      ? `Tool result (${tool.toolRequested?.tool}): ${JSON.stringify(
          tool.toolResult,
        )}`
      : "";

  // 4. Assemble the prompt:
  //    Persona → Memory → Knowledge → Tool result → History → User message.
  const history = await listMessages(conversationId);
  const historyMessages: ChatMessage[] = history
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));
  // In debug we did not persist, so append the current message explicitly.
  if (debug) historyMessages.push({ role: "user", content: message.trim() });

  const chatMessages: ChatMessage[] = [
    { role: "system", content: HAJI_PERSONA.system },
    ...(memory.block ? [{ role: "system" as const, content: memory.block }] : []),
    ...(knowledge.block
      ? [{ role: "system" as const, content: knowledge.block }]
      : []),
    ...(toolBlock ? [{ role: "system" as const, content: toolBlock }] : []),
    ...historyMessages,
  ];

  // 4. Route through the AI infrastructure layer (with fallback).
  const result = await routeChat(chatMessages, {
    preferredModelId: typeof modelId === "string" ? modelId : undefined,
  });

  // 5. Persist the assistant reply + auto-title (skipped in debug).
  let title = convo.title;
  if (!debug) {
    await addMessage({
      conversationId,
      role: "assistant",
      content: result.text,
      modelId: result.modelId,
    });
    if (convo.title === "New chat") {
      title = message.trim().slice(0, 60);
      await setConversationTitle(conversationId, title);
    }
  }

  return Response.json({
    conversationId,
    response: result.text,
    modelId: result.modelId,
    title,
    ...(debug
      ? {
          debug: {
            memories: memory.memories,
            memoryCount: memory.count,
            knowledge: knowledge.chunks,
            knowledgeCount: knowledge.count,
            memoryBlock: memory.block,
            knowledgeBlock: knowledge.block,
            toolRequested: tool.toolRequested,
            toolExecuted: tool.toolExecuted,
            toolResult: tool.toolResult,
          },
        }
      : {}),
  });
}
