"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  ChevronRight,
  Folder,
  FolderPlus,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

type Conv = { id: string; title: string };
type Proj = { id: string; name: string; isSystem?: boolean };
type BrainEntry = { id: string; name: string; slug: string; icon: string; color: string };

const SECTION_KEYS = ["projects", "brains", "recent"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

function useSectionCollapse() {
  const STORAGE_KEY = "sidebar_collapsed";
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw) as SectionKey[]) : new Set<SectionKey>();
    } catch {
      return new Set<SectionKey>();
    }
  });

  function toggle(key: SectionKey) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /**/ }
      return next;
    });
  }

  return { collapsed, toggle };
}

export default function Sidebar({
  conversations,
  projects,
  brains,
  activeId,
  onSelect,
  onNew,
  onNewProject,
  onDelete,
  onRename,
  open,
  onClose,
}: {
  conversations: Conv[];
  projects: Proj[];
  brains?: BrainEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewProject: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [projectChats, setProjectChats] = useState<Record<string, Conv[]>>({});
  const [loadingProj, setLoadingProj] = useState<string | null>(null);
  const { collapsed, toggle: toggleSection } = useSectionCollapse();

  async function toggleProject(id: string) {
    if (expanded.has(id)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    setExpanded((prev) => new Set([...prev, id]));
    if (!projectChats[id]) {
      setLoadingProj(id);
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          setProjectChats((prev) => ({ ...prev, [id]: data.chats ?? [] }));
        }
      } finally {
        setLoadingProj(null);
      }
    }
  }

  // System projects float to the top, then alphabetical.
  const sorted = [...projects].sort((a, b) => {
    if (a.isSystem && !b.isSystem) return -1;
    if (!a.isSystem && b.isSystem) return 1;
    return a.name.localeCompare(b.name);
  });

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
          {/* Projects */}
          <div className="mb-1 flex items-center justify-between px-2 pt-1">
            <button
              onClick={() => toggleSection("projects")}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className={`size-3 transition-transform ${collapsed.has("projects") ? "" : "rotate-90"}`} />
              Projects
            </button>
            <button
              onClick={onNewProject}
              aria-label="New project"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <FolderPlus className="size-4" />
            </button>
          </div>

          {!collapsed.has("projects") && sorted.length === 0 ? (
            <p className="px-2 pb-2 text-xs text-muted-foreground">No projects yet</p>
          ) : !collapsed.has("projects") ? (
            <ul className="mb-2 space-y-0.5">
              {sorted.map((p) => {
                const isOpen = expanded.has(p.id);
                const chats = projectChats[p.id];
                return (
                  <li key={p.id}>
                    {/* Project row */}
                    <div className="flex items-center gap-0.5 rounded-lg active:bg-accent/60 md:hover:bg-accent/60">
                      <button
                        onClick={() => toggleProject(p.id)}
                        aria-label={isOpen ? "Collapse project" : "Expand project"}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight
                          className={`size-3.5 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                        />
                      </button>

                      <a
                        href={`/projects/${p.id}`}
                        className="flex min-h-9 flex-1 min-w-0 items-center gap-2 text-sm"
                      >
                        {p.isSystem ? (
                          <Brain className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Folder className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {p.isSystem ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Global
                          </span>
                        ) : null}
                      </a>
                    </div>

                    {/* Expanded: project chats */}
                    {isOpen && (
                      <ul className="ml-5 mt-0.5 space-y-0.5 border-l pl-2">
                        {loadingProj === p.id && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">Loading…</li>
                        )}
                        {chats?.length === 0 && loadingProj !== p.id && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">No chats yet</li>
                        )}
                        {chats?.map((c) => (
                          <li key={c.id}>
                            <div
                              onClick={() => { onSelect(c.id); onClose(); }}
                              className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm ${
                                activeId === c.id
                                  ? "bg-accent"
                                  : "active:bg-accent/60 md:hover:bg-accent/60"
                              }`}
                            >
                              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{c.title}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Brains */}
          {brains && brains.length > 0 && (
            <>
              <div className="mb-1 flex items-center px-2 pt-1">
                <button
                  onClick={() => toggleSection("brains")}
                  className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={`size-3 transition-transform ${collapsed.has("brains") ? "" : "rotate-90"}`} />
                  Brains
                </button>
              </div>
              {!collapsed.has("brains") && (
                <ul className="mb-2 space-y-0.5">
                  {brains.map((b) => (
                    <li key={b.id}>
                      <a
                        href={`/?brain=${b.slug}`}
                        className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm active:bg-accent/60 md:hover:bg-accent/60"
                      >
                        <span className="text-base leading-none">{b.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{b.name}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Recent Chats */}
          <div className="mb-1 flex items-center px-2 pt-1">
            <button
              onClick={() => toggleSection("recent")}
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className={`size-3 transition-transform ${collapsed.has("recent") ? "" : "rotate-90"}`} />
              Recent Chats
            </button>
          </div>
          {!collapsed.has("recent") && conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <MessageSquare className="size-6 text-muted-foreground/60" />
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground">
                Tap "New Chat" to start your first conversation.
              </p>
            </div>
          ) : !collapsed.has("recent") ? (
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
          ) : null}
        </nav>
      </aside>
    </>
  );
}
