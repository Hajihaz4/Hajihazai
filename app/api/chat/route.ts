import { auth } from "@/auth";
import {
  addMessage,
  getConversation,
  listMessages,
  setConversationTitle,
} from "@/lib/db/queries";
import { HAJI_MODEL, HAJI_PERSONA } from "@/lib/ai/persona";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId, message } = await req.json();
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

  // 2. Build context (Haji persona + recent history) and call the model.
  const history = await listMessages(conversationId);
  const ollamaMessages = [
    { role: "system", content: HAJI_PERSONA.system },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ];

  let answer = "";
  try {
    const res = await fetch(`${OLLAMA_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: HAJI_MODEL,
        messages: ollamaMessages,
        stream: false,
      }),
    });
    const data = await res.json();
    answer = data?.message?.content ?? "";
  } catch {
    answer = "⚠️ HajiHaz could not reach the local model (Ollama).";
  }

  // 3. Persist the assistant's reply.
  await addMessage({
    conversationId,
    role: "assistant",
    content: answer,
    modelId: HAJI_MODEL,
  });

  // 4. Auto-title the conversation from the first user message.
  let title = convo.title;
  if (convo.title === "New chat") {
    title = message.trim().slice(0, 60);
    await setConversationTitle(conversationId, title);
  }

  return Response.json({ conversationId, response: answer, title });
}
