"use client";

import { useState } from "react";
import { Brain, Check, Pencil, Plus, Trash2, X } from "lucide-react";

type Memory = {
  id: string;
  type: string;
  content: string;
  updatedAt?: string;
};

export default function MemoryViewer({
  initialMemories,
}: {
  initialMemories: Memory[];
}) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [type, setType] = useState("note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editContent, setEditContent] = useState("");

  async function createMemory() {
    const text = content.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type.trim() || "note", content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((p) => [data.memory, ...p]);
        setContent("");
        setType("note");
      }
    } finally {
      setSaving(false);
    }
  }

  function startEdit(m: Memory) {
    setEditingId(m.id);
    setEditType(m.type);
    setEditContent(m.content);
  }

  async function saveEdit(id: string) {
    const text = editContent.trim();
    if (!text) return;
    const res = await fetch(`/api/memories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: editType.trim() || "note", content: text }),
    });
    if (res.ok) {
      const data = await res.json();
      setMemories((p) => p.map((m) => (m.id === id ? data.memory : m)));
      setEditingId(null);
    }
  }

  async function removeMemory(id: string) {
    const res = await fetch(`/api/memories/${id}`, { method: "DELETE" });
    if (res.ok) setMemories((p) => p.filter((m) => m.id !== id));
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <Brain className="size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
      </div>

      {/* Create */}
      <div className="mb-8 rounded-xl border p-4">
        <div className="flex flex-col gap-3">
          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="type (e.g. note, preference)"
            className="w-48 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="What should HajiHaz remember?"
            className="resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div>
            <button
              onClick={createMemory}
              disabled={saving || !content.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="size-4" /> Add memory
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      {memories.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No memories yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {memories.map((m) => (
            <li key={m.id} className="rounded-xl border p-4">
              {editingId === m.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-48 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(m.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                    >
                      <Check className="size-4" /> Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      <X className="size-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {m.type}
                    </span>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.content}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => startEdit(m)}
                      aria-label="Edit memory"
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => removeMemory(m.id)}
                      aria-label="Delete memory"
                      className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
