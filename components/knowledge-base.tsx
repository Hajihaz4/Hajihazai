"use client";

import { useState } from "react";
import { BookOpen, Plus, Trash2 } from "lucide-react";

type SourceType = "pdf" | "text" | "website" | "note";
type DocStatus = "processing" | "active" | "failed";
type Doc = {
  id: string;
  title: string;
  sourceType: SourceType;
  status: DocStatus;
};

const SOURCE_TYPES: SourceType[] = ["note", "text", "pdf", "website"];

export default function KnowledgeBase({
  initialDocuments,
}: {
  initialDocuments: Doc[];
}) {
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("note");
  const [saving, setSaving] = useState(false);

  async function addDocument() {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, sourceType }),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments((p) => [data.document, ...p]);
        setTitle("");
        setSourceType("note");
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeDocument(id: string) {
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (res.ok) setDocuments((p) => p.filter((d) => d.id !== id));
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <BookOpen className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
      </div>

      {/* Add */}
      <div className="mb-8 rounded-xl border p-4">
        <div className="flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as SourceType)}
              className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              onClick={addDocument}
              disabled={saving || !title.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="size-4" /> Add document
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {documents.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No documents yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {d.sourceType}
                  </span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="mt-1.5 truncate font-medium">{d.title}</p>
              </div>
              <button
                onClick={() => removeDocument(d.id)}
                aria-label="Delete document"
                className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: DocStatus }) {
  const styles: Record<DocStatus, string> = {
    active: "bg-green-600/10 text-green-600",
    processing: "bg-amber-500/15 text-amber-600",
    failed: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}
