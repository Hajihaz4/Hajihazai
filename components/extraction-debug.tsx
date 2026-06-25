"use client";

import { useState } from "react";
import { Bug, Play } from "lucide-react";

type Candidate = { type: string; content: string; durable: boolean };
type Rejected = Candidate & { reason: string };
type Diagnostics = {
  rawOutput: string;
  malformed: boolean;
  parsed: Candidate[];
  accepted: Candidate[];
  rejected: Rejected[];
};
type Result = {
  model: string | null;
  preview: boolean;
  diagnostics: Diagnostics | null;
  count: number;
};

export default function ExtractionDebug() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(true);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/memories/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview }),
      });
      if (!res.ok) {
        setError(`${res.status} — ${await res.text()}`);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  const d = data?.diagnostics;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Bug className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Extraction Debug
        </h1>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          <Play className="size-4" />
          {loading ? "Running…" : "Run on recent chat"}
        </button>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
          Preview only (don&apos;t save)
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Model: <code>{data.model ?? "—"}</code> · Mode:{" "}
            {data.preview ? "preview (not saved)" : `saved ${data.count} pending`}
          </p>

          <Section title="Raw model output">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
              {d?.malformed ? "[malformed — no JSON array found]\n" : ""}
              {d?.rawOutput || "(empty)"}
            </pre>
          </Section>

          <Section title={`Parsed candidates (${d?.parsed.length ?? 0})`}>
            <CandidateList items={d?.parsed ?? []} />
          </Section>

          <Section title={`Accepted candidates (${d?.accepted.length ?? 0})`}>
            <CandidateList items={d?.accepted ?? []} tone="accept" />
          </Section>

          <Section title={`Rejected candidates (${d?.rejected.length ?? 0})`}>
            {d && d.rejected.length > 0 ? (
              <ul className="space-y-2">
                {d.rejected.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 rounded-lg border border-dashed p-2 text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground">[{r.type}]</span>{" "}
                      {r.content || "(no content)"}
                    </span>
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      {r.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </Section>
        </div>
      ) : null}
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function CandidateList({
  items,
  tone,
}: {
  items: Candidate[];
  tone?: "accept";
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">None</p>;
  return (
    <ul className="space-y-2">
      {items.map((c, i) => (
        <li
          key={i}
          className={`rounded-lg border p-2 text-sm ${
            tone === "accept" ? "border-green-600/30 bg-green-600/5" : ""
          }`}
        >
          <span className="text-muted-foreground">[{c.type}]</span> {c.content}
          {c.durable ? "" : " · durable=false"}
        </li>
      ))}
    </ul>
  );
}
