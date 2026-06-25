"use client";

import { useState } from "react";
import { Search } from "lucide-react";

type Result = {
  id: string;
  type: string;
  content: string;
  status: string;
  score: number;
  updatedAt: string;
};
type Excluded = {
  id: string;
  type: string;
  content: string;
  status: string;
  reason: string;
};

export default function RetrievalDebug() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    query: string;
    results: Result[];
    excluded: Excluded[];
  } | null>(null);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/memories/search?debug=1&q=${encodeURIComponent(q)}`,
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
          Retrieval Debug
        </h1>
      </div>

      <div className="mb-8 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Search query (e.g. Suplaykart, LLB, AllBee) — empty = all"
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
        <div className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Query: <code>{data.query || "(all active)"}</code>
          </p>

          <section>
            <h2 className="mb-2 text-sm font-medium">
              Retrieved memories ({data.results.length})
            </h2>
            {data.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-2">
                {data.results.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground">[{m.type}]</span>{" "}
                      {m.content}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                      score {m.score.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium">
              Excluded memories ({data.excluded.length})
            </h2>
            {data.excluded.length === 0 ? (
              <p className="text-sm text-muted-foreground">None</p>
            ) : (
              <ul className="space-y-2">
                {data.excluded.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-3 text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground">[{m.type}]</span>{" "}
                      {m.content}
                    </span>
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      {m.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
