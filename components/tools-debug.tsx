"use client";

import { useState } from "react";
import { Wrench } from "lucide-react";

const TOOLS = [
  { name: "memory_search", label: "Memory Search", sample: '{ "query": "what business do I run" }' },
  { name: "knowledge_search", label: "Knowledge Search", sample: '{ "query": "vacation policy" }' },
  { name: "calculator", label: "Calculator", sample: '{ "expression": "(50000 + 70000) * 0.18" }' },
  { name: "current_time", label: "Current Time", sample: "{}" },
];

export default function ToolsDebug() {
  const [tool, setTool] = useState(TOOLS[0].name);
  const [inputText, setInputText] = useState(TOOLS[0].sample);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function selectTool(name: string) {
    setTool(name);
    setResult(null);
    const t = TOOLS.find((x) => x.name === name);
    setInputText(t?.sample ?? "{}");
  }

  async function execute() {
    setLoading(true);
    setResult(null);
    try {
      let input: unknown;
      try {
        input = JSON.parse(inputText || "{}");
      } catch {
        setResult("Invalid JSON input");
        return;
      }
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, input }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Wrench className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
      </div>

      <div className="space-y-3">
        <select
          value={tool}
          onChange={(e) => selectTool(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {TOOLS.map((t) => (
            <option key={t.name} value={t.name}>
              {t.label}
            </option>
          ))}
        </select>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder="Input JSON"
          className="w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <button
          onClick={execute}
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "Executing…" : "Execute"}
        </button>

        {result !== null ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
            {result}
          </pre>
        ) : null}
      </div>
    </main>
  );
}
