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
import { shouldRetrieve } from "@/lib/ai/should-retrieve";
import { wrapToolOutput } from "@/lib/tools/output-guard";
import type { ChatMessage } from "@/lib/ai/types";
import { buildConversationTurns } from "@/lib/ai/conversation-turns";
import { needsResolution, resolveReference } from "@/lib/ai/reference-resolution";
import { detectMultiBrainScope } from "@/lib/ai/multi-brain";

const CHAT_RATE_LIMIT = 30;
const CHAT_RATE_WINDOW_MS = 60_000;
const MESSAGE_MAX_CHARS = 10_000;
const TOOL_RESULT_MAX_CHARS = 10_000;

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/**
 * Multi-brain retrieval (Phase 4): retrieve from several brains and merge.
 * Brains are disjoint (a document belongs to one brain), so no cross-brain dedup
 * is needed. Legal is excluded by the detector, preserving legal isolation.
 */
async function retrieveMultiBrain(
  userId: string,
  query: string,
  projectId: string | null,
  slugs: string[],
) {
  const brains = (
    await Promise.all(slugs.map((s) => getBrainBySlug(s).catch(() => null)))
  ).filter((b): b is NonNullable<typeof b> => b !== null);
  const results = (
    await Promise.all(
      brains.map((b) =>
        buildKnowledgeContext(userId, { query, projectId, brainId: b.id }).catch(() => null),
      ),
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);
  return {
    block: results.map((r) => r.block).filter(Boolean).join("\n\n"),
    chunks: results.flatMap((r) => r.chunks),
    count: results.reduce((s, r) => s + r.count, 0),
  };
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

  // Reference resolution (Phase 3): if the message uses a pronoun with no named
  // entity ("where does he study?"), resolve it to the most recent conversation
  // entity so routing + retrieval target the intended subject. History is only
  // fetched when a pronoun is present (no cost otherwise). The user-facing message
  // and stored history are unchanged — only the routing/retrieval query is enriched.
  let retrievalQuery = message;
  let refInfo: ReturnType<typeof resolveReference> | null = null;
  if (needsResolution(message)) {
    const prior = await listRecentMessages(conversationId, 8).catch(() => []);
    refInfo = resolveReference(message, prior.filter((m) => m.role === "user").map((m) => m.content));
    retrievalQuery = refInfo.resolved;
  }

  // ── Phase 1: all independent lookups run in parallel ─────────────────────
  // None of these depend on each other; they only need userId + retrievalQuery.
  const effectiveBrainMode: BrainMode = brainMode === "smart" ? "smart" : "manual";
  // Smart routing → { brain, confidence, matchedKeywords, reason }. brain may be
  // null (no match / low confidence) — we then clarify / answer without a brain.
  const route = effectiveBrainMode === "smart" ? routeToBrain(retrievalQuery) : null;
  const resolvedBrainSlug = route?.brain ?? null;

  // Greetings / low-information acknowledgements ("hi", "thanks", "ok") must not
  // trigger RAG — otherwise memory + knowledge get injected into small talk.
  const wantRetrieval = shouldRetrieve(message);
  const EMPTY_MEMORY = { block: "", memories: [] as Awaited<ReturnType<typeof buildMemoryContext>>["memories"], count: 0, fallbackUsed: false };
  const EMPTY_KNOWLEDGE = { block: "", chunks: [] as Awaited<ReturnType<typeof buildKnowledgeContext>>["chunks"], count: 0 };

  const WRITE_INTENT_RE =
    /\b(remember|save|update|store|add|don'?t forget)\b.{0,40}\b(this|that|it|knowledge|memory|information|info)\b/i;
  const hasWriteIntent = !admin && WRITE_INTENT_RE.test(message) && !!session.user.email;

  const [convo, memory, tool, brainForSmart, writePermitted] = await Promise.all([
    getConversation(session.user.id, conversationId),
    wantRetrieval
      ? buildMemoryContext(session.user.id, { query: retrievalQuery }).catch((err) => {
          console.warn("[chat] memory context failed:", err);
          return EMPTY_MEMORY;
        })
      : Promise.resolve(EMPTY_MEMORY),
    shouldCheckTools(message)
      ? selectAndRunTool(session.user.id, message, { audit: true })
      : Promise.resolve<ToolExecution>({ toolRequested: null, toolExecuted: false, toolResult: null, run: null }),
    resolvedBrainSlug ? getBrainBySlug(resolvedBrainSlug).catch(() => null) : Promise.resolve(null),
    hasWriteIntent
      ? isKnowledgeWritePermitted(session.user.email!).catch(() => false)
      : Promise.resolve(true),
  ]);

  if (!convo) {
    return new Response("Not found", { status: 404 });
  }

  const projectId = convo.projectId ?? null;
  const resolvedBrainId: string | null =
    effectiveBrainMode === "smart"
      ? (brainForSmart?.id ?? null)
      : typeof clientBrainId === "string"
      ? clientBrainId
      : null;

  // Smart mode that produced no confident brain → skip brain-scoped knowledge
  // retrieval (never fall through to an unscoped "search everything"), and hint
  // the model to ask which area the user means when the question looks domain-
  // specific (Phase D — no silent routing).
  const smartUnrouted = effectiveBrainMode === "smart" && resolvedBrainId === null;
  // Multi-brain (Phase 4): queries spanning brains ("compare AllBee and Suplaykart",
  // "what businesses does Haji own") retrieve from several brains and merge. Empty
  // = normal single-brain retrieval. Legal is excluded (isolation).
  const multiBrains = effectiveBrainMode === "smart" ? detectMultiBrainScope(retrievalQuery) : [];
  const isMulti = multiBrains.length >= 2;
  const wantKnowledge = wantRetrieval && (isMulti || !smartUnrouted);
  const clarifyBlock = smartUnrouted && !isMulti && wantRetrieval
    ? "SYSTEM: The smart router could not confidently pick a knowledge brain for this message. If the message is an ambiguous role or entity reference — e.g. \"founder\", \"CEO\", \"ownership\", \"owner\" — without naming a company, ask which company or organization they mean (for example: \"Founder of what?\", \"CEO of which company?\", \"Ownership of which organization?\"). If it clearly refers to the user's specific businesses (AllBee, Suplaykart), personal/family life, or law, ask which area they mean. Otherwise answer normally from general knowledge."
    : "";

  // ── Phase 2: parallel lookups that depend on convo.projectId + brainId ──
  // addMessage also runs here — ownership is confirmed above, and Phase 2
  // completes before streaming starts so userMsg is available for the SSE event.
  const [project, knowledge, history, userMsgResult] = await Promise.all([
    projectId ? getProject(session.user.id, projectId) : Promise.resolve(null),
    wantKnowledge
      ? (isMulti
          ? retrieveMultiBrain(session.user.id, retrievalQuery, projectId, multiBrains)
          : buildKnowledgeContext(session.user.id, {
              query: retrievalQuery,
              projectId,
              brainId: resolvedBrainId ?? undefined,
            })
        ).catch((err) => {
          console.warn("[chat] knowledge context failed:", err);
          return EMPTY_KNOWLEDGE;
        })
      : Promise.resolve(EMPTY_KNOWLEDGE),
    listRecentMessages(conversationId, 20),
    !debug && !regenerate
      ? addMessage({ conversationId, role: "user", content: message })
      : Promise.resolve(null),
  ]);

  const userMsg = userMsgResult;
  const projectInstructions = project?.instructions?.trim() ?? "";

  let toolBlock = "";
  if (tool.toolExecuted && tool.toolResult != null) {
    let serialized = JSON.stringify(tool.toolResult);
    if (serialized.length > TOOL_RESULT_MAX_CHARS) {
      serialized = serialized.slice(0, TOOL_RESULT_MAX_CHARS) + "…[truncated]";
    }
    toolBlock = wrapToolOutput(tool.toolRequested?.tool ?? "tool", serialized);
  }

  const writeIntentBlock = hasWriteIntent && !writePermitted
    ? "SYSTEM NOTICE: This user does NOT have permission to update system knowledge. If they ask you to save, remember, update, or store any information to your knowledge base or memory, respond with: \"You do not have permission to update system knowledge. Please contact an admin.\" Do not pretend to save anything."
    : "";

  // Build the conversation turns so the CURRENT message is always the final user
  // turn. Previously this relied on listRecentMessages() (which races the parallel
  // addMessage write) and only appended the current message in debug mode, so in
  // production the model answered the PREVIOUS turn. See lib/ai/conversation-turns.
  const historyMessages: ChatMessage[] = buildConversationTurns(history, message, {
    regenerate,
    currentUserMessageId: userMsg?.id,
  });

  const chatMessages: ChatMessage[] = [
    { role: "system", content: HAJI_PERSONA.system },
    ...(projectInstructions
      ? [{ role: "system" as const, content: `Project instructions:\n${projectInstructions}` }]
      : []),
    ...(memory.block ? [{ role: "system" as const, content: memory.block }] : []),
    ...(knowledge.block ? [{ role: "system" as const, content: knowledge.block }] : []),
    ...(toolBlock ? [{ role: "system" as const, content: toolBlock }] : []),
    ...(writeIntentBlock ? [{ role: "system" as const, content: writeIntentBlock }] : []),
    ...(clarifyBlock ? [{ role: "system" as const, content: clarifyBlock }] : []),
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
                  multiBrains: isMulti ? multiBrains : null,
                  brainConfidence: route?.confidence ?? null,
                  brainMatched: route?.matchedKeywords ?? null,
                  brainReason: route?.reason ?? (clarifyBlock ? "clarification requested" : null),
                  knowledgeCount: knowledge.count,
                  memoryCount: memory.count,
                  retrievalMethod: !wantKnowledge
                    ? "none"
                    : memory.fallbackUsed
                    ? "keyword-fallback"
                    : "semantic",
                  // Phase 5 — real retrieved source documents (never hallucinated).
                  sources: [...new Set(knowledge.chunks.map((c) => c.title))],
                  // Phase 3 — reference resolution outcome.
                  referenceEntity: refInfo?.entity ?? null,
                  referenceReason: refInfo?.reason ?? null,
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
