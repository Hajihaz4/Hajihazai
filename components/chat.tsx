"use client";

import { useEffect, useRef } from "react";
import { RotateCw, Send } from "lucide-react";
import { listEnabledModels } from "@/lib/ai/registry";

type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string | null;
  fallbackFrom?: string | null;
  error?: boolean;
  retryText?: string;
};

// modelId → human label for per-message provenance.
const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  listEnabledModels().map((m) => [m.modelId, m.displayName]),
);

const label = (id?: string | null) => (id ? MODEL_LABELS[id] ?? id : "");

export default function Chat({
  messages,
  input,
  setInput,
  onSend,
  onRetry,
  sending,
  loading,
}: {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onRetry: (text: string) => void;
  sending: boolean;
  loading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
              className="space-y-6"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="max-w-[85%] sm:max-w-[80%]">
                    <div
                      className={`break-anywhere whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : m.error
                            ? "border border-destructive/30 bg-destructive/10 text-foreground"
                            : "bg-muted"
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* Error → Retry */}
                    {m.error && m.retryText ? (
                      <button
                        onClick={() => onRetry(m.retryText!)}
                        className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium hover:bg-accent"
                      >
                        <RotateCw className="size-3.5" /> Retry
                      </button>
                    ) : null}

                    {/* Model provenance / fallback notice */}
                    {!m.error &&
                    m.role === "assistant" &&
                    m.modelId &&
                    m.modelId !== "none" ? (
                      m.fallbackFrom ? (
                        <div className="mt-1 px-1 text-xs text-amber-600">
                          ⚠️ {label(m.fallbackFrom)} failed — using {label(m.modelId)}
                        </div>
                      ) : (
                        <div className="mt-1 px-1 text-xs text-muted-foreground">
                          {label(m.modelId)}
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              ))}

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

      <div className="border-t p-3 pb-safe sm:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
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
            // text-base (16px) on mobile prevents iOS auto-zoom on focus.
            className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm"
          />
          <button
            onClick={onSend}
            disabled={sending || !input.trim()}
            aria-label="Send message"
            aria-busy={sending}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
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
