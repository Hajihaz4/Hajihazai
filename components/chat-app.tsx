"use client";

import { useEffect, useRef, useState } from "react";
import { Bug, Menu, PlusCircle } from "lucide-react";
import Sidebar from "./sidebar";
import Chat from "./chat";
import Modal from "./modal";
import ProfileMenu from "./profile-menu";
import type { BrainOption, BrainMode } from "./brain-selector";

type Conv = { id: string; title: string };
type Proj = { id: string; name: string; isSystem?: boolean };
type LevelOption = {
  level: string;
  label: string;
  enabled?: boolean;
  comingSoon?: boolean;
  available?: boolean;
};
export type MsgMeta = {
  provider?: string;
  model?: string;
  requestedModelId?: string | null;
  fallbackFrom?: string | null;
  attempts?: number | null;
  latencyMs?: number | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    approx?: boolean;
  } | null;
  brainId?: string | null;
  brainSlug?: string | null;
  brainMode?: string | null;
};
export type Msg = {
  id: string;
  dbId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  error?: boolean;
  retryText?: string;
  meta?: MsgMeta | null;
};
type User = { name?: string | null; email?: string | null; image?: string | null };

const CHAT_TIMEOUT_MS = 60_000;
const uuid = () => crypto.randomUUID();

export default function ChatApp({
  user,
  initialConversations,
  levels: initialLevels,
  isAdmin,
  openConversationId,
}: {
  user: User;
  initialConversations: Conv[];
  levels: LevelOption[];
  isAdmin: boolean;
  openConversationId?: string;
}) {
  const [conversations, setConversations] = useState<Conv[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    // Open a specific chat when arriving from a project workspace (?c=…).
    (openConversationId &&
      initialConversations.some((c) => c.id === openConversationId)
      ? openConversationId
      : initialConversations[0]?.id) ?? null,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projects, setProjects] = useState<Proj[]>([]);

  const [levels, setLevels] = useState<LevelOption[]>(initialLevels);
  const [level, setLevel] = useState<string>(
    initialLevels.find((l) => l.available)?.level ?? "medium",
  );
  const [debug, setDebug] = useState(false);

  // Brain system state
  const [brains, setBrains] = useState<BrainOption[]>([]);
  const [selectedBrainId, setSelectedBrainId] = useState<string | null>(null);
  const [brainMode, setBrainMode] = useState<BrainMode>("manual");

  // Conversation management modals.
  const [pendingDelete, setPendingDelete] = useState<Conv | null>(null);
  const [renaming, setRenaming] = useState<Conv | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Toast.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }

  // Initial conversation + live health refresh (hides failing models).
  useEffect(() => {
    if (activeId) void openConversation(activeId);
    void refreshLevels();
    void loadProjects();
    void loadBrains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBrains() {
    try {
      const res = await fetch("/api/brains");
      if (!res.ok) return;
      const data = await res.json();
      const loaded: BrainOption[] = (data.brains ?? []).map(
        (b: { id: string; name: string; slug: string; icon: string; color: string }) => ({
          id: b.id, name: b.name, slug: b.slug, icon: b.icon, color: b.color,
        }),
      );
      setBrains(loaded);
      // Auto-select Haji Core as the default brain.
      const hajiCore = loaded.find((b) => b.slug === "haji-core");
      if (hajiCore && !selectedBrainId) setSelectedBrainId(hajiCore.id);
    } catch {
      /* best-effort */
    }
  }

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      setProjects(
        (data.projects ?? []).map((p: { id: string; name: string; isSystem?: boolean }) => ({
          id: p.id,
          name: p.name,
          isSystem: p.isSystem ?? false,
        })),
      );
    } catch {
      /* best-effort */
    }
  }

  async function newProject() {
    const name = window.prompt("Project name");
    if (!name?.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.project) {
      setProjects((p) => [{ id: data.project.id, name: data.project.name }, ...p]);
    }
  }

  async function refreshLevels() {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.levels) && data.levels.length > 0) {
        setLevels(data.levels);
        setLevel((cur) => {
          const stillOk = data.levels.find(
            (l: LevelOption) => l.level === cur && l.available,
          );
          if (stillOk) return cur;
          return (
            data.default ??
            data.levels.find((l: LevelOption) => l.available)?.level ??
            cur
          );
        });
      }
    } catch {
      /* health endpoint best-effort — keep server-provided levels */
    }
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      const loaded: Msg[] = (data.messages ?? []).map(
        (m: { id: string; role: Msg["role"]; content: string }) => ({
          id: m.id,
          dbId: m.id,
          role: m.role,
          content: m.content,
        }),
      );
      setMessages(loaded);
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
    setConversations((p) => p.map((c) => (c.id === id ? { ...c, title } : c)));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }

  /* ---------------------------- message actions --------------------------- */

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied to clipboard");
    } catch {
      notify("Copy failed");
    }
  }

  function deleteMessage(msg: Msg) {
    setMessages((p) => p.filter((m) => m.id !== msg.id));
    if (msg.dbId) {
      void fetch(`/api/messages/${msg.dbId}`, { method: "DELETE" }).catch(() => {});
    }
  }

  function retryMessage(msg: Msg) {
    // A failed send → resend the original user text.
    if (msg.error) {
      setMessages((p) => p.filter((m) => m.id !== msg.id));
      void runChat(msg.retryText ?? "", {});
      return;
    }
    // An assistant reply → regenerate from the preceding user message.
    const idx = messages.findIndex((m) => m.id === msg.id);
    if (idx < 0) return;
    let priorText = "";
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        priorText = messages[i].content;
        break;
      }
    }
    if (!priorText) return;
    if (msg.dbId) {
      void fetch(`/api/messages/${msg.dbId}`, { method: "DELETE" }).catch(() => {});
    }
    setMessages((p) => p.filter((m) => m.id !== msg.id));
    void runChat(priorText, { regenerate: true });
  }

  function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const localId = uuid();
    setMessages((p) => [...p, { id: localId, role: "user", content: text }]);
    void runChat(text, { userLocalId: localId });
  }

  async function runChat(
    text: string,
    opts: { userLocalId?: string; regenerate?: boolean },
  ) {
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
          body: JSON.stringify({
            conversationId: convId,
            message: text,
            level,
            regenerate: opts.regenerate ?? false,
            brainId: brainMode === "manual" ? selectedBrainId : null,
            brainMode,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Patch the just-sent user message with its persisted id (for delete).
      if (opts.userLocalId && data.userMessageId) {
        setMessages((p) =>
          p.map((m) =>
            m.id === opts.userLocalId ? { ...m, dbId: data.userMessageId } : m,
          ),
        );
      }

      setMessages((p) => [
        ...p,
        {
          id: data.assistantMessageId ?? uuid(),
          dbId: data.assistantMessageId ?? null,
          role: "assistant",
          content: data.response ?? "",
          meta: data.meta ?? null,
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
        projects={projects}
        brains={brains}
        activeId={activeId}
        onSelect={openConversation}
        onNew={newChat}
        onNewProject={newProject}
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
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setDebug((d) => !d)}
                aria-label="Toggle debug mode"
                aria-pressed={debug}
                title="Debug mode (admin)"
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg border sm:size-9 ${
                  debug ? "bg-accent text-foreground" : "text-muted-foreground"
                }`}
              >
                <Bug className="size-4" />
              </button>
            ) : null}

            <label className="sr-only" htmlFor="level-select">
              Response quality level
            </label>
            <select
              id="level-select"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="min-w-0 rounded-lg border bg-background px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:px-3 sm:py-1.5"
            >
              {levels.map((l) => (
                <option key={l.level} value={l.level} disabled={!l.available}>
                  {l.label}
                  {l.comingSoon ? " (Coming Soon)" : ""}
                </option>
              ))}
            </select>

            <ProfileMenu name={user.name} image={user.image} />
          </div>
        </header>

        <Chat
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={send}
          onCopy={copyMessage}
          onDelete={deleteMessage}
          onRetry={retryMessage}
          sending={sending}
          loading={loading}
          isAdmin={isAdmin}
          debug={debug}
          brains={brains}
          selectedBrainId={selectedBrainId}
          brainMode={brainMode}
          onSelectBrain={setSelectedBrainId}
          onToggleBrainMode={() => setBrainMode((m) => m === "manual" ? "smart" : "manual")}
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

      {/* Toast */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
