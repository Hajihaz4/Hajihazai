"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu, PlusCircle } from "lucide-react";
import Sidebar from "./sidebar";
import Chat from "./chat";
import Modal from "./modal";
import { signOutAction } from "@/app/actions";

type Conv = { id: string; title: string };
type ModelOption = { modelId: string; displayName: string };
type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string | null;
  fallbackFrom?: string | null;
  error?: boolean;
  retryText?: string;
};
type User = { name?: string | null; email?: string | null; image?: string | null };

const CHAT_TIMEOUT_MS = 60_000;
const uuid = () => crypto.randomUUID();

export default function ChatApp({
  user,
  initialConversations,
  models,
}: {
  user: User;
  initialConversations: Conv[];
  models: ModelOption[];
}) {
  const [conversations, setConversations] = useState<Conv[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modelId, setModelId] = useState<string>(models[0]?.modelId ?? "");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Conversation management modals.
  const [pendingDelete, setPendingDelete] = useState<Conv | null>(null);
  const [renaming, setRenaming] = useState<Conv | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Load the most recent conversation automatically on first render.
  useEffect(() => {
    if (activeId) void openConversation(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
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
    setSidebarOpen(false);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function saveRename() {
    if (!renaming) return;
    const id = renaming.id;
    const title = renameValue.trim();
    setRenaming(null);
    if (!title) return;
    // Optimistic update.
    setConversations((p) => p.map((c) => (c.id === id ? { ...c, title } : c)));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((p) => [...p, { id: uuid(), role: "user", content: text }]);
    void runChat(text);
  }

  function retry(text: string) {
    setMessages((p) => p.filter((m) => !m.error));
    void runChat(text);
  }

  async function runChat(text: string) {
    if (sending) return;
    setSending(true);

    let convId = activeId;
    try {
      if (!convId) {
        const res = await fetch("/api/conversations", { method: "POST" });
        const convo: Conv = await res.json();
        setConversations((p) => [convo, ...p]);
        convId = convo.id;
        setActiveId(convId);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: convId, message: text, modelId }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const served: string | undefined = data.modelId;
      const requested: string | undefined = data.requestedModelId ?? modelId;
      const fallbackFrom =
        served && served !== "none" && requested && served !== requested
          ? requested
          : null;

      setMessages((p) => [
        ...p,
        {
          id: uuid(),
          role: "assistant",
          content: data.response ?? "",
          modelId: data.modelId,
          fallbackFrom,
        },
      ]);

      if (data.title) {
        setConversations((p) =>
          p.map((c) => (c.id === convId ? { ...c, title: data.title } : c)),
        );
      }
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      setMessages((p) => [
        ...p,
        {
          id: uuid(),
          role: "assistant",
          content: aborted
            ? "⏱️ The request timed out. Please try again."
            : "⚠️ Couldn't reach HajiHaz. Check your connection and try again.",
          error: true,
          retryText: text,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onNew={newChat}
        onDelete={(id) =>
          setPendingDelete(conversations.find((c) => c.id === id) ?? null)
        }
        onRename={(id) => {
          const c = conversations.find((x) => x.id === id) ?? null;
          setRenaming(c);
          setRenameValue(c?.title ?? "");
        }}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversations"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-accent md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-accent md:hidden"
          >
            <PlusCircle className="size-5" />
          </button>

          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="size-7 shrink-0 rounded-full" />
            ) : null}
            <div className="min-w-0 text-sm">
              <div className="truncate font-medium leading-tight">{user.name}</div>
              <div className="truncate text-xs leading-tight text-muted-foreground">
                {user.email}
              </div>
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              aria-label="Select model"
              className="min-w-0 max-w-[40vw] truncate rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-none sm:px-3 sm:py-1.5"
            >
              {models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.displayName}
                </option>
              ))}
            </select>

            <form action={signOutAction}>
              <button
                aria-label="Sign out"
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm hover:bg-accent sm:px-3 sm:py-1.5"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

        <Chat
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={send}
          onRetry={retry}
          sending={sending}
          loading={loading}
        />
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete conversation?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          “{pendingDelete?.title}” and all its messages will be permanently
          removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setPendingDelete(null)}
            className="min-h-10 rounded-lg border px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={confirmDelete}
            className="min-h-10 rounded-lg bg-destructive px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Rename */}
      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename conversation"
      >
        <input
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveRename()}
          className="mb-4 w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setRenaming(null)}
            className="min-h-10 rounded-lg border px-4 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={saveRename}
            disabled={!renameValue.trim()}
            className="min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}
