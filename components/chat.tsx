"use client";

import { useEffect, useRef, useCallback } from "react";
import { Copy, RotateCw, Send, Square, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Msg } from "./chat-app";
import BrainSelector, { type BrainOption, type BrainMode } from "./brain-selector";
import { ProfileCard, isProfileCardQuery, DEFAULT_PROFILE } from "./profile-card";

const NEAR_BOTTOM_PX = 80; // px from bottom to trigger auto-scroll

export default function Chat({
  messages,
  input,
  setInput,
  onSend,
  onCopy,
  onDelete,
  onRetry,
  onStop,
  sending,
  isGenerating,
  loading,
  isAdmin,
  debug,
  brains,
  selectedBrainId,
  brainMode,
  onSelectBrain,
  onToggleBrainMode,
}: {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onCopy: (text: string) => void;
  onDelete: (msg: Msg) => void;
  onRetry: (msg: Msg) => void;
  onStop: () => void;
  sending: boolean;
  isGenerating: boolean;
  loading: boolean;
  isAdmin: boolean;
  debug: boolean;
  brains: BrainOption[];
  selectedBrainId: string | null;
  brainMode: BrainMode;
  onSelectBrain: (id: string | null) => void;
  onToggleBrainMode: () => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track whether user is near the bottom of the scroll container.
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = dist < NEAR_BOTTOM_PX;
  }, []);

  // Auto-scroll: instant during streaming (smooth would fight the user), smooth on new message.
  useEffect(() => {
    if (!isNearBottomRef.current) return;
    const isStreaming = messages.some((m) => m.streaming);
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "instant" : "smooth" });
  }, [messages, sending]);

  // When a conversation loads (messages go from 0 → N), always jump to bottom.
  const prevCountRef = useRef(messages.length);
  useEffect(() => {
    const wasEmpty = prevCountRef.current === 0;
    const hasMessages = messages.length > 0;
    if (wasEmpty && hasMessages) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      isNearBottomRef.current = true;
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Auto-resize textarea as content changes.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4 sm:py-6">
          {loading ? (
            <MessagesSkeleton />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center sm:py-24">
              <h2 className="text-2xl font-semibold">HajiHaz AI</h2>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground sm:text-base">
                Ask anything — your conversations are saved automatically.
              </p>
            </div>
          ) : (
            <div
              className="space-y-5"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((m, idx) => {
                const isUser = m.role === "user";
                const prevMsg = messages[idx - 1];
                const showProfileCard =
                  !isUser &&
                  prevMsg?.role === "user" &&
                  isProfileCardQuery(prevMsg.content);

                return (
                  <div
                    key={m.id}
                    className={`group flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="max-w-[85%] sm:max-w-[80%]">
                      <div
                        className={`break-anywhere rounded-2xl px-4 py-2.5 text-sm ${
                          isUser
                            ? "bg-primary text-primary-foreground"
                            : m.error
                              ? "border border-destructive/30 bg-destructive/10 text-foreground"
                              : "bg-muted"
                        }`}
                      >
                        {isUser ? (
                          <span className="whitespace-pre-wrap">{m.content}</span>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:rounded-lg prose-pre:border prose-pre:bg-background/60 prose-code:rounded prose-code:bg-background/60 prose-code:px-1 prose-code:text-[0.8em]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </ReactMarkdown>
                            {m.streaming && (
                              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle opacity-70" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action bar — hover on desktop, always shown on mobile. */}
                      {!m.streaming && (
                        <div
                          className={`mt-1 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 ${
                            isUser ? "justify-end" : "justify-start"
                          }`}
                        >
                          <ActionButton label="Copy" onClick={() => onCopy(m.content)}>
                            <Copy className="size-3.5" />
                          </ActionButton>

                          {m.role === "assistant" ? (
                            <ActionButton
                              label={m.error ? "Retry" : "Regenerate"}
                              onClick={() => onRetry(m)}
                            >
                              <RotateCw className="size-3.5" />
                            </ActionButton>
                          ) : null}

                          <ActionButton label="Delete" onClick={() => onDelete(m)} danger>
                            <Trash2 className="size-3.5" />
                          </ActionButton>
                        </div>
                      )}

                      {isAdmin && debug && m.role === "assistant" && m.meta ? (
                        <DebugPanel meta={m.meta} />
                      ) : null}

                      {showProfileCard && <ProfileCard data={DEFAULT_PROFILE} />}
                    </div>
                  </div>
                );
              })}

              {/* Loading dots — only while pre-processing (before first token arrives) */}
              {sending && (
                <div className="flex justify-start" aria-live="polite">
                  <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
                    <span className="sr-only">HajiHaz is responding…</span>
                    <Dot delay="0ms" />
                    <Dot delay="150ms" />
                    <Dot delay="300ms" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t">
        {brains.length > 0 && (
          <div className="border-b px-1">
            <BrainSelector
              brains={brains}
              selectedBrainId={selectedBrainId}
              brainMode={brainMode}
              onSelectBrain={onSelectBrain}
              onToggleMode={onToggleBrainMode}
            />
          </div>
        )}

        <div className="p-3 pb-safe sm:p-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              aria-label="Message"
              placeholder="Message HajiHaz AI…"
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            />
            {isGenerating ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop generation"
                title="Stop generation"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background text-foreground hover:bg-accent"
              >
                <Square className="size-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent ${
        danger ? "hover:text-destructive" : "hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function DebugPanel({ meta }: { meta: NonNullable<Msg["meta"]> }) {
  const u = meta.usage;
  return (
    <div className="mt-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
      <div>provider: {meta.provider ?? "—"} · model: {meta.model ?? "—"}</div>
      <div>
        latency: {meta.latencyMs ?? "—"}ms · tokens{u?.approx ? "≈" : ":"} {u?.totalTokens ?? "—"} (p
        {u?.promptTokens ?? "—"}/c{u?.completionTokens ?? "—"})
      </div>
      {meta.fallbackFrom ? (
        <div className="text-amber-600">
          fallback: {meta.fallbackFrom} → {meta.model} (attempts {meta.attempts ?? "—"})
        </div>
      ) : null}
      {meta.brainSlug || meta.brainId ? (
        <div className="text-violet-500">
          brain: {meta.brainSlug ?? meta.brainId} · mode: {meta.brainMode ?? "manual"}
        </div>
      ) : null}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
      style={{ animationDelay: delay }}
    />
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex justify-end">
        <div className="h-10 w-40 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-start">
        <div className="h-20 w-64 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-28 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="flex justify-start">
        <div className="h-16 w-56 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
