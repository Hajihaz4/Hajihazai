"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";

type Conv = { id: string; title: string };

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conv[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex h-full w-72 flex-col border-r bg-muted/30">
      <div className="p-3">
        <button
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="size-4" /> New Chat
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <div
                  onClick={() => onSelect(c.id)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    activeId === c.id ? "bg-accent" : "hover:bg-accent/60"
                  }`}
                >
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                    }}
                    aria-label="Delete conversation"
                    className="text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
