import { auth } from "@/auth";
import {
  addMessage,
  getConversation,
  listRecentMessages,
  setConversationTitle,
} from "@/lib/db/queries";
import { HAJI_PERSONA } from "@/lib/ai/persona";
import { routeChatStream } from "@/lib/ai/router";
import { getProject } from "@/lib/db/project-queries";
import { resolveLevel, isLevel, isLevelEnabled } from "@/lib/ai/levels";
import { isModelUsable } from "@/lib/ai/health";
import { isAdmin } from "@/lib/auth/admin";
import { rateLimitResponse } from "@/lib/ratelimit";
import { isMaintenanceMode } from "@/lib/system-settings";
import { isKnowledgeWritePermitted } from "@/lib/admin/queries";
import { routeToBrain, type BrainMode } from "@/lib/ai/brain-router";
import { getBrainBySlug } from "@/lib/db/brain-queries";
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

const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW_MS = 60_000;
const MESSAGE_MAX_CHARS = 10_000;
const TOOL_RESULT_MAX_CHARS = 10_000;

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = isAdmin(session.user.email);

  // Maintenance mode — block non-admins
  if (!admin) {
    const maintenance = await isMaintenanceMode().catch(() => false);
    if (maintenance) {
      const body = new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(sse({ t: "error", message: "System is currently under maintenance. Please try again later." }));
          ctrl.close();
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
  }

  const debug =
    admin &&
    ["1", "true"].includes(new URL(req.url).searchParams.get("debug") ?? "");

  const limited = rateLimitResponse(
    `chat:${session.user.id}`,
    CHAT_RATE_LIMIT,
    CHAT_RATE_WINDOW_MS,
  );
  if (limited) return limited;

  const { conversationId, message, modelId, level, regenerate, brainId: clientBrainId, brainMode } = await req.json();
  if (!conversationId || typeof message !== "string" || !message.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  let preferredModelId: string | undefined;
  if (isLevel(level)) {
    const effective = isLevelEnabled(level) ? level : "medium";
    preferredModelId = resolveLevel(effective) ?? undefined;
  } else if (typeof modelId === "string" && isModelUsable(modelId)) {
    preferredModelId = modelId;
  }
  if (message.length > MESSAGE_MAX_CHARS) {
    return new Response(`message exceeds ${MESSAGE_MAX_CHARS} characters`, { status: 413 });
  }

  const convo = await getConversation(session.user.id, conversationId);
  if (!convo) {
    return new Response("Not found", { status: 404 });
  }

  const projectId = convo.projectId ?? null;
  let projectInstructions = "";
  if (projectId) {
    const project = await getProject(session.user.id, projectId);
    projectInstructions = project?.instructions?.trim() ?? "";
  }

  let userMsg: Awaited<ReturnType<typeof addMessage>> | null = null;
  if (!debug && !regenerate) {
    userMsg = await addMessage({ conversationId, role: "user", content: message });
  }

  let memory: Awaited<ReturnType<typeof buildMemoryContext>>;
  try {
    memory = await buildMemoryContext(session.user.id, { query: message });
  } catch (err) {
    console.warn("[chat] memory context failed:", err);
    memory = { block: "", memories: [], count: 0, fallbackUsed: false };
  }

  let resolvedBrainId: string | null = null;
  let resolvedBrainSlug: string | null = null;
  const effectiveBrainMode: BrainMode = brainMode === "smart" ? "smart" : "manual";

  if (effectiveBrainMode === "smart") {
    resolvedBrainSlug = routeToBrain(message);
    const brain = await getBrainBySlug(resolvedBrainSlug).catch(() => null);
    resolvedBrainId = brain?.id ?? null;
  } else if (clientBrainId && typeof clientBrainId === "string") {
    resolvedBrainId = clientBrainId;
  }

  let knowledge: Awaited<ReturnType<typeof buildKnowledgeContext>>;
  try {
    knowledge = await buildKnowledgeContext(session.user.id, {
      query: message,
      projectId,
      brainId: resolvedBrainId ?? undefined,
    });
  } catch (err) {
    console.warn("[chat] knowledge context failed:", err);
    knowledge = { block: "", chunks: [], count: 0 };
  }

  const tool: ToolExecution = shouldCheckTools(message)
    ? await selectAndRunTool(session.user.id, message, { audit: true })
    : { toolRequested: null, toolExecuted: false, toolResult: null, run: null };
  let toolBlock = "";
  if (tool.toolExecuted && tool.toolResult != null) {
    let serialized = JSON.stringify(tool.toolResult);
    if (serialized.length > TOOL_RESULT_MAX_CHARS) {
      serialized = serialized.slice(0, TOOL_RESULT_MAX_CHARS) + "…[truncated]";
    }
    toolBlock = wrapToolOutput(tool.toolRequested?.tool ?? "tool", serialized);
  }

  const history = await listRecentMessages(conversationId, 20);
  const historyMessages: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  if (debug) historyMessages.push({ role: "user", content: message.trim() });

  // Warn the AI when write-intent is detected for unauthorized users
  const WRITE_INTENT_RE =
    /\b(remember|save|update|store|add|don'?t forget)\b.{0,40}\b(this|that|it|knowledge|memory|information|info)\b/i;
  let writeIntentBlock = "";
  if (!admin && WRITE_INTENT_RE.test(message)) {
    const permitted = session.user.email
      ? await isKnowledgeWritePermitted(session.user.email).catch(() => false)
      : false;
    if (!permitted) {
      writeIntentBlock =
        "SYSTEM NOTICE: This user does NOT have permission to update system knowledge. If they ask you to save, remember, update, or store any information to your knowledge base or memory, respond with: \"You do not have permission to update system knowledge. Please contact an admin.\" Do not pretend to save anything.";
    }
  }

  const chatMessages: ChatMessage[] = [
    { role: "system", content: HAJI_PERSONA.system },
    ...(projectInstructions
      ? [{ role: "system" as const, content: `Project instructions:\n${projectInstructions}` }]
      : []),
    ...(memory.block ? [{ role: "system" as const, content: memory.block }] : []),
    ...(knowledge.block ? [{ role: "system" as const, content: knowledge.block }] : []),
    ...(toolBlock ? [{ role: "system" as const, content: toolBlock }] : []),
    ...(writeIntentBlock ? [{ role: "system" as const, content: writeIntentBlock }] : []),
    ...historyMessages,
  ];

  // Stream the response via SSE.
  const streamResult = await routeChatStream(chatMessages, { preferredModelId });
  const startMs = Date.now();

  const CHUNK_TIMEOUT_MS = 30_000;

  const body = new ReadableStream({
    async start(controller) {
      let fullText = "";
      const iter = streamResult.stream[Symbol.asyncIterator]();
      try {
        while (true) {
          const next = await Promise.race([
            iter.next(),
            new Promise<"timeout">((resolve) =>
              setTimeout(() => resolve("timeout"), CHUNK_TIMEOUT_MS),
            ),
          ]);
          if (next === "timeout") {
            throw Object.assign(new Error("provider timeout"), { timedOut: true });
          }
          if (next.done) break;
          fullText += next.value;
          controller.enqueue(sse({ t: "chunk", text: next.value }));
        }
      } catch (err) {
        if (!debug && fullText.trim()) {
          await addMessage({
            conversationId,
            role: "assistant",
            content: fullText.trimEnd() + "\n\n*[Response interrupted]*",
            modelId: streamResult.modelId,
          }).catch(() => {});
        }
        const isTimeout = (err as { timedOut?: boolean }).timedOut === true;
        console.error("[chat] stream error:", isTimeout ? "provider timeout" : err);
        controller.enqueue(sse({ t: "error", message: isTimeout ? "Request timed out" : "Stream interrupted" }));
        controller.close();
        return;
      }

      // Persist assistant reply + auto-title after streaming completes.
      let assistantMsgId: string | null = null;
      let title = convo.title;
      const latencyMs = Date.now() - startMs;
      if (!debug) {
        const assistantMsg = await addMessage({
          conversationId,
          role: "assistant",
          content: fullText,
          modelId: streamResult.modelId,
        });
        assistantMsgId = assistantMsg.id;
        if (convo.title === "New chat") {
          title = message.trim().slice(0, 60);
          await setConversationTitle(session.user.id, conversationId, title);
        }
      }

      controller.enqueue(
        sse({
          t: "done",
          conversationId,
          userMessageId: userMsg?.id ?? null,
          assistantMessageId: assistantMsgId,
          title,
          modelId: streamResult.modelId,
          requestedModelId: preferredModelId ?? null,
          ...(admin
            ? {
                meta: {
                  provider: streamResult.provider,
                  model: streamResult.modelId,
                  requestedModelId: streamResult.requestedModelId,
                  latencyMs,
                  brainId: resolvedBrainId,
                  brainSlug: resolvedBrainSlug,
                  brainMode: effectiveBrainMode,
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
        }),
      );
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
