"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import Sidebar from "./sidebar";
import Chat from "./chat";
import { signOutAction } from "@/app/actions";
import { listEnabledModels } from "@/lib/ai/registry";

type Conv = { id: string; title: string };
type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string | null;
  fallbackFrom?: string | null;
};
type User = { name?: string | null; email?: string | null; image?: string | null };

const MODELS = listEnabledModels();

export default function ChatApp({
  user,
  initialConversations,
}: {
  user: User;
  initialConversations: Conv[];
}) {
  const [conversations, setConversations] = useState<Conv[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState<string>(MODELS[0]?.modelId ?? "");

  // Load the most recent conversation automatically on first render.
  useEffect(() => {
    if (activeId) void openConversation(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openConversation(id: string) {
    setActiveId(id);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function newChat() {
    const res = await fetch("/api/conversations", { method: "POST" });
    const convo: Conv = await res.json();
    setConversations((p) => [convo, ...p]);
    setActiveId(convo.id);
    setMessages([]);
  }

  async function removeConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    let convId = activeId;
    try {
      // Auto-create a conversation if none is active.
      if (!convId) {
        const res = await fetch("/api/conversations", { method: "POST" });
        const convo: Conv = await res.json();
        setConversations((p) => [convo, ...p]);
        convId = convo.id;
        setActiveId(convId);
      }

      setMessages((p) => [
        ...p,
        { id: crypto.randomUUID(), role: "user", content: text },
      ]);
      setInput("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId, message: text, modelId }),
      });
      const data = await res.json();

      // Detect fallback: the served model differs from the one the user picked.
      const served: string | undefined = data.modelId;
      const requested: string | undefined = data.requestedModelId ?? modelId;
      const fallbackFrom =
        served && served !== "none" && requested && served !== requested
          ? requested
          : null;

      setMessages((p) => [
        ...p,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response ?? "",
          modelId: data.modelId,
          fallbackFrom,
        },
      ]);

      // Reflect the auto-generated title in the sidebar.
      if (data.title) {
        setConversations((p) =>
          p.map((c) => (c.id === convId ? { ...c, title: data.title } : c)),
        );
      }
    } catch {
      setMessages((p) => [
        ...p,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ Failed to reach HajiHaz. Please try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-dvh">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={removeConversation}
      />

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-7 rounded-full" />
            ) : null}
            <div className="text-sm">
              <div className="font-medium leading-tight">{user.name}</div>
              <div className="text-xs leading-tight text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Select model"
              className="rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {MODELS.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.displayName}
                </option>
              ))}
            </select>

            <form action={signOutAction}>
              <button className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        </header>

        <Chat
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={send}
          sending={sending}
          loading={loading}
        />
      </div>
    </div>
  );
}
