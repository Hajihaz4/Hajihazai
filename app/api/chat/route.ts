import { auth } from "@/auth";
import {
  addMessage,
  getConversation,
  listMessages,
  setConversationTitle,
} from "@/lib/db/queries";
import { HAJI_PERSONA } from "@/lib/ai/persona";
import { routeChat } from "@/lib/ai/router";
import type { ChatMessage } from "@/lib/ai/types";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId, message, modelId } = await req.json();
  if (!conversationId || typeof message !== "string" || !message.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  // Ownership guard — the conversation must belong to the signed-in user.
  const convo = await getConversation(session.user.id, conversationId);
  if (!convo) {
    return new Response("Not found", { status: 404 });
  }

  // 1. Persist the user's message immediately.
  await addMessage({ conversationId, role: "user", content: message });

  // 2. Build context (Haji persona + recent history).
  const history = await listMessages(conversationId);
  const chatMessages: ChatMessage[] = [
    { role: "system", content: HAJI_PERSONA.system },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ];

  // 3. Route through the AI infrastructure layer (with fallback).
  const result = await routeChat(chatMessages, {
    preferredModelId: typeof modelId === "string" ? modelId : undefined,
  });

  // 4. Persist the assistant reply WITH the model that produced it.
  await addMessage({
    conversationId,
    role: "assistant",
    content: result.text,
    modelId: result.modelId,
  });

  // 5. Auto-title the conversation from the first user message.
  let title = convo.title;
  if (convo.title === "New chat") {
    title = message.trim().slice(0, 60);
    await setConversationTitle(conversationId, title);
  }

  return Response.json({
    conversationId,
    response: result.text,
    modelId: result.modelId,
    title,
  });
}
