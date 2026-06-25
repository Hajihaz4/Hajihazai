"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type Hit = {
  documentId: string;
  title: string;
  chunkId: string;
  content: string;
  similarity: number;
};

export default function KnowledgeSearchDebug() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    query: string;
    threshold: number;
    results: Hit[];
  } | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/knowledge/search?q=${encodeURIComponent(q)}`,
      );
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Search className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Knowledge Search
        </h1>
      </div>

      <div className="mb-8 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Search your documents semantically…"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {data ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Query: <code>{data.query}</code> · threshold ≥{" "}
            {data.threshold.toFixed(2)}
          </p>
          {data.results.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No chunks above the similarity threshold.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.results.map((h) => (
                <li
                  key={h.chunkId}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{h.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                      {h.similarity.toFixed(3)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {h.content.slice(0, 200)}
                    {h.content.length > 200 ? "…" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </main>
  );
}
