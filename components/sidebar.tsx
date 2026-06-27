"use client";

import { MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";

type Conv = { id: string; title: string };

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  open,
  onClose,
}: {
  conversations: Conv[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[82%] max-w-xs flex-col border-r bg-background transition-transform duration-200 ease-out md:static md:z-auto md:w-72 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2 p-3">
          <button
            onClick={onNew}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="size-4" /> New Chat
          </button>
          <button
            onClick={onClose}
            aria-label="Close conversations"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-accent md:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <MessageSquare className="size-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground">
                Tap “New Chat” to start your first conversation.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => (
                <li key={c.id}>
                  <div
                    onClick={() => onSelect(c.id)}
                    className={`group flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm ${
                      activeId === c.id
                        ? "bg-accent"
                        : "active:bg-accent/60 md:hover:bg-accent/60"
                    }`}
                  >
                    <MessageSquare className="ml-1 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRename(c.id);
                      }}
                      aria-label="Rename conversation"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:opacity-0 md:transition md:group-hover:opacity-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      aria-label="Delete conversation"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive md:opacity-0 md:transition md:group-hover:opacity-100"
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
    </>
  );
}
