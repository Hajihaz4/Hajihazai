"use client";

import { useState } from "react";
import { Boxes, Check, X } from "lucide-react";

type Row = {
  id: string;
  content: string;
  status: string;
  embedded: boolean;
  dimensions: number;
};

export default function EmbeddingDebug({ initialRows }: { initialRows: Row[] }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function embedAll() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/memories/embed", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setNotice(
          `Embedded ${d.embedded}/${d.total} active memories (dim ${d.dimensions}).`,
        );
        // Reload to reflect stored vectors.
        setTimeout(() => window.location.reload(), 600);
      } else {
        setNotice(await res.text());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Memory Embeddings
          </h1>
        </div>
        <button
          onClick={embedAll}
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Embedding…" : "Embed all active"}
        </button>
      </div>

      {notice ? (
        <p className="mb-6 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {initialRows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No memories yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {initialRows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {r.status}
                </span>
                <p className="mt-1.5 truncate">{r.content}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">
                  dim {r.dimensions}
                </span>
                {r.embedded ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="size-4" /> yes
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <X className="size-4" /> no
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
