import { auth } from "@/auth";
import {
  addMessage,
  getConversation,
  listRecentMessages,
  setConversationTitle,
} from "@/lib/db/queries";
import { HAJI_PERSONA } from "@/lib/ai/persona";
import { routeChat } from "@/lib/ai/router";
import { resolveLevel, isLevel } from "@/lib/ai/levels";
import { isModelUsable } from "@/lib/ai/health";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimitResponse } from "@/lib/ratelimit";

// Chat makes 1–2 LLM calls per turn — throttle per user (same mechanism as tools).
const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW_MS = 60_000;
const MESSAGE_MAX_CHARS = 10_000;
const TOOL_RESULT_MAX_CHARS = 10_000;
import {
  buildMemoryContext,
  buildKnowledgeContext,
} from "@/lib/memory/context";
import {
  selectAndRunTool,
  type ToolExecution,
} from "@/lib/tools/tool-calling";
import { shouldCheckTools } from "@/lib/tools/should-check-tools";
import { wrapToolOutput } from "@/lib/tools/output-guard";
import type { ChatMessage } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const debug =
    ["1", "true"].includes(new URL(req.url).searchParams.get("debug") ?? "");

  const limited = rateLimitResponse(
    `chat:${session.user.id}`,
    CHAT_RATE_LIMIT,
    CHAT_RATE_WINDOW_MS,
  );
  if (limited) return limited;

  const { conversationId, message, modelId, level, regenerate } = await req.json();
  if (!conversationId || typeof message !== "string" || !message.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  // Resolve the requested capability level (Low/Medium/High/Max) to a healthy
  // model, falling back down its chain. A raw modelId is honored only if usable.
  let preferredModelId: string | undefined;
  if (isLevel(level)) {
    preferredModelId = resolveLevel(level) ?? undefined;
  } else if (typeof modelId === "string" && isModelUsable(modelId)) {
    preferredModelId = modelId;
  }
  const admin = isAdmin(session.user.email);
  if (message.length > MESSAGE_MAX_CHARS) {
    return new Response(`message exceeds ${MESSAGE_MAX_CHARS} characters`, {
      status: 413,
    });
  }

  // Ownership guard — the conversation must belong to the signed-in user.
  const convo = await getConversation(session.user.id, conversationId);
  if (!convo) {
    return new Response("Not found", { status: 404 });
  }

  // 1. Persist the user's message (skipped in debug, and on regenerate where
  //    the user message already exists in the conversation).
  let userMsg: Awaited<ReturnType<typeof addMessage>> | null = null;
  if (!debug && !regenerate) {
    userMsg = await addMessage({ conversationId, role: "user", content: message });
  }

  // 2. Build memory + knowledge context via semantic retrieval on the message.
  //    These embed the query — if the embedding provider fails (e.g. Gemini
  //    429 quota with no fallback configured), DEGRADE gracefully to no
  //    context instead of 500-ing the whole chat turn.
  let memory: Awaited<ReturnType<typeof buildMemoryContext>>;
  try {
    memory = await buildMemoryContext(session.user.id, { query: message });
  } catch (err) {
    console.warn("[chat] memory context failed — continuing with empty context:", err);
    memory = { block: "", memories: [], count: 0, fallbackUsed: false };
  }

  let knowledge: Awaited<ReturnType<typeof buildKnowledgeContext>>;
  try {
    knowledge = await buildKnowledgeContext(session.user.id, { query: message });
  } catch (err) {
    console.warn("[chat] knowledge context failed — continuing with empty context:", err);
    knowledge = { block: "", chunks: [], count: 0 };
  }

  // 3. Single tool-calling step — fast-path skips detection for small talk.
  //    At most ONE tool executed; audited; output wrapped in a safety guard.
  const tool: ToolExecution = shouldCheckTools(message)
    ? await selectAndRunTool(session.user.id, message, { audit: true })
    : { toolRequested: null, toolExecuted: false, toolResult: null, run: null };
  let toolBlock = "";
  if (tool.toolExecuted && tool.toolResult != null) {
    // Cap tool result before it enters the prompt.
    let serialized = JSON.stringify(tool.toolResult);
    if (serialized.length > TOOL_RESULT_MAX_CHARS) {
      serialized = serialized.slice(0, TOOL_RESULT_MAX_CHARS) + "…[truncated]";
    }
    toolBlock = wrapToolOutput(tool.toolRequested?.tool ?? "tool", serialized);
  }

  // 4. Assemble the prompt:
  //    Persona → Memory → Knowledge → Tool result → History → User message.
  const history = await listRecentMessages(conversationId, 20);
  const historyMessages: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
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
  const result = await routeChat(chatMessages, { preferredModelId });

  // 5. Persist the assistant reply + auto-title (skipped in debug).
  let title = convo.title;
  let assistantMsg: Awaited<ReturnType<typeof addMessage>> | null = null;
  if (!debug) {
    assistantMsg = await addMessage({
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
    modelId: result.modelId, // the model that actually served the response
    requestedModelId: preferredModelId ?? null,
    userMessageId: userMsg?.id ?? null,
    assistantMessageId: assistantMsg?.id ?? null,
    title,
    // Admin-only routing diagnostics — never sent to normal users.
    ...(admin
      ? {
          meta: {
            provider: result.provider,
            model: result.modelId,
            requestedModelId: result.requestedModelId ?? null,
            fallbackFrom: result.fallbackFrom ?? null,
            attempts: result.attempts ?? null,
            latencyMs: result.latencyMs ?? null,
            usage: result.usage ?? null,
          },
        }
      : {}),
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
            toolRun: tool.run,
          },
        }
      : {}),
  });
}
