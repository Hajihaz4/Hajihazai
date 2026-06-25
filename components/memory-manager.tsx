"use client";

import { useMemo, useState } from "react";
import { Download, ShieldAlert, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";

type Status = "active" | "pending" | "deleted";
type Memory = { id: string; type: string; content: string; status: Status };
type Stats = { active: number; pending: number; deleted: number; total: number };
type Filter = "all" | Status;

export default function MemoryManager({
  initialMemories,
  initialStats,
}: {
  initialMemories: Memory[];
  initialStats: Stats;
}) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => (filter === "all" ? memories : memories.filter((m) => m.status === filter)),
    [memories, filter],
  );

  async function refresh() {
    const res = await fetch("/api/memories?status=all");
    if (res.ok) {
      const data = await res.json();
      setMemories(data.memories);
      setStats(data.stats);
      setSelected(new Set());
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const allSelected = visible.every((m) => prev.has(m.id));
      if (allSelected) return new Set();
      return new Set(visible.map((m) => m.id));
    });
  }

  async function bulk(action: "approve" | "reject" | "delete") {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    try {
      await fetch("/api/memories/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [...selected] }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function forgetAll() {
    if (
      !window.confirm(
        "Delete ALL of your memories? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    try {
      await fetch("/api/memories/forget-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const FILTERS: Filter[] = ["all", "active", "pending", "deleted"];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Manage Memory
      </h1>

      {/* Statistics */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <Stat label="Active" value={stats.active} />
        <Stat label="Pending" value={stats.pending} />
        <Stat label="Deleted" value={stats.deleted} />
        <Stat label="Total" value={stats.total} />
      </div>

      {/* Filters + global actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${
                filter === f ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <a
            href="/api/memories/export"
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Download className="size-4" /> Export
          </a>
          <button
            onClick={forgetAll}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <ShieldAlert className="size-4" /> Forget everything
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <button
          onClick={toggleAllVisible}
          className="rounded-lg border px-3 py-1.5 hover:bg-accent"
        >
          {visible.length > 0 && visible.every((m) => selected.has(m.id))
            ? "Clear"
            : "Select all"}
        </button>
        <span className="text-muted-foreground">{selected.size} selected</span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => bulk("approve")}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
          >
            <ThumbsUp className="size-4" /> Approve
          </button>
          <button
            onClick={() => bulk("reject")}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-accent disabled:opacity-40"
          >
            <ThumbsDown className="size-4" /> Reject
          </button>
          <button
            onClick={() => bulk("delete")}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No memories in this view.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-3 rounded-lg border p-3 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {m.type}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-1.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border p-3 text-center">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    active: "bg-green-600/10 text-green-600",
    pending: "bg-amber-500/15 text-amber-600",
    deleted: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {status}
    </span>
  );
}
