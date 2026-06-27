"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ────────────────────────────────────────────────────── */

type AdminRow = { id: string; username: string; createdAt: string; createdBy: string | null };
type DataTab = "users" | "projects" | "documents" | "knowledge" | "brains";

type BrainRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  isSystem: boolean;
  documentCount?: number;
  chunkCount?: number;
};

type Analytics = {
  totalUsers: number;
  totalConversations: number;
  totalMessages: number;
  totalDocuments: number;
  totalChunks: number;
  totalBrains: number;
  totalMemories: number;
};

type KDoc = {
  id: string;
  title: string;
  category: string | null;
  sourceType: string;
  status: string;
  projectId: string | null;
  projectName: string | null;
  brainId: string | null;
  brainName: string | null;
  brainIcon: string | null;
  userId: string;
  userEmail: string | null;
  createdAt: string;
};

type UserOpt = { id: string; email: string | null };
type ProjOpt = { id: string; name: string; userId: string };
type BrainOpt = { id: string; name: string; icon: string };

const CATEGORIES = ["Personal", "Family", "Education", "Business", "Trading", "Law", "Custom"];

/* ── Component ─────────────────────────────────────────────────── */

export default function AdminPortal() {
  /* auth */
  const [status, setStatus] = useState<"loading" | "login" | "dashboard">("loading");

  /* login form */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* shared */
  const [error, setError] = useState<string | null>(null);

  /* admins section */
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newU, setNewU] = useState("");
  const [newP, setNewP] = useState("");

  /* data tab */
  const [dataTab, setDataTab] = useState<DataTab>("users");
  const [dataRows, setDataRows] = useState<Record<string, unknown>[]>([]);

  /* knowledge list */
  const [knowledge, setKnowledge] = useState<KDoc[]>([]);
  const [kSearch, setKSearch] = useState("");
  const [kCatFilter, setKCatFilter] = useState("");
  const [kProjFilter, setKProjFilter] = useState("");

  /* knowledge form state */
  type FormMode = "hidden" | "add" | "edit";
  const [formMode, setFormMode] = useState<FormMode>("hidden");
  const [editId, setEditId] = useState<string | null>(null);
  const [fUserId, setFUserId] = useState("");
  const [fProjId, setFProjId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fContent, setFContent] = useState("");
  const [fSaving, setFSaving] = useState(false);

  /* pickers */
  const [allUsers, setAllUsers] = useState<UserOpt[]>([]);
  const [allProjects, setAllProjects] = useState<ProjOpt[]>([]);
  const [allBrainsOpt, setAllBrainsOpt] = useState<BrainOpt[]>([]);
  const [fBrainId, setFBrainId] = useState("");

  /* brains tab */
  const [brains, setBrains] = useState<BrainRow[]>([]);
  const [brainForm, setBrainForm] = useState<{ name: string; slug: string; description: string; icon: string; color: string } | null>(null);
  const [brainEditId, setBrainEditId] = useState<string | null>(null);
  const [brainSaving, setBrainSaving] = useState(false);
  const [kBrainFilter, setKBrainFilter] = useState("");

  /* analytics */
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  /* ── loaders ───────────────────────────────────────────────── */

  const loadAdmins = useCallback(async (initial = false) => {
    const res = await fetch("/api/admin/admins");
    if (res.status === 401) { setStatus("login"); return; }
    const d = await res.json().catch(() => ({}));
    setAdmins(d.admins ?? []);
    setStatus("dashboard");
    if (initial) {
      void loadTab("users");
      void loadKnowledge();
      void loadPickers();
      void loadBrains();
      void loadAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void loadAdmins(true); }, [loadAdmins]);

  async function loadTab(tab: DataTab) {
    setDataTab(tab);
    if (tab === "knowledge") { void loadKnowledge(); return; }
    if (tab === "brains") { void loadBrains(); return; }
    const res = await fetch(`/api/admin/data?view=${tab}`);
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setDataRows((d[tab] as Record<string, unknown>[]) ?? []);
  }

  async function loadKnowledge() {
    const res = await fetch("/api/admin/knowledge?withBrain=1");
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setKnowledge(d.knowledge ?? []);
  }

  async function loadBrains() {
    const res = await fetch("/api/admin/brains?view=stats");
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setBrains(d.brains ?? []);
  }

  async function loadAnalytics() {
    const res = await fetch("/api/admin/analytics");
    if (!res.ok) return;
    const d = await res.json().catch(() => ({}));
    setAnalytics(d.analytics ?? null);
  }

  async function loadPickers() {
    const [uRes, pRes, bRes] = await Promise.all([
      fetch("/api/admin/data?view=users"),
      fetch("/api/admin/projects"),
      fetch("/api/admin/brains?view=picker"),
    ]);
    if (uRes.ok) {
      const d = await uRes.json().catch(() => ({}));
      setAllUsers(
        ((d.users ?? []) as { id: string; email: string | null }[]).map((u) => ({
          id: u.id, email: u.email,
        })),
      );
    }
    if (pRes.ok) {
      const d = await pRes.json().catch(() => ({}));
      setAllProjects((d.projects ?? []) as ProjOpt[]);
    }
    if (bRes.ok) {
      const d = await bRes.json().catch(() => ({}));
      setAllBrainsOpt((d.brains ?? []).map((b: { id: string; name: string; icon: string }) => ({
        id: b.id, name: b.name, icon: b.icon,
      })));
    }
  }

  /* ── admin CRUD ─────────────────────────────────────────────── */

  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Login failed"); return; }
    setPassword(""); void loadAdmins(true);
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const res = await fetch("/api/admin/admins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newU, password: newP }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Could not create admin"); return; }
    setNewU(""); setNewP(""); void loadAdmins();
  }

  async function deleteAdmin(id: string) {
    if (!confirm("Delete this admin?")) return;
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Could not delete"); return; }
    void loadAdmins();
  }

  async function resetAdmin(id: string) {
    const pw = prompt("New password (min 8 chars):"); if (!pw) return;
    const res = await fetch(`/api/admin/admins/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json().catch(() => ({}));
    setError(res.ok ? null : (d.error ?? "Could not reset"));
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }); setStatus("login");
  }

  /* ── brain CRUD ──────────────────────────────────────────────── */

  function openBrainAdd() {
    setBrainEditId(null);
    setBrainForm({ name: "", slug: "", description: "", icon: "🧠", color: "#6366f1" });
    setError(null);
  }

  function openBrainEdit(b: BrainRow) {
    setBrainEditId(b.id);
    setBrainForm({ name: b.name, slug: b.slug, description: b.description ?? "", icon: b.icon, color: b.color });
    setError(null);
  }

  async function saveBrain(e: React.FormEvent) {
    e.preventDefault(); setError(null); setBrainSaving(true);
    try {
      const method = brainEditId ? "PATCH" : "POST";
      const url = brainEditId ? `/api/admin/brains/${brainEditId}` : "/api/admin/brains";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brainForm),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Could not save brain"); return; }
      setBrainForm(null); setBrainEditId(null); void loadBrains(); void loadAnalytics();
    } finally { setBrainSaving(false); }
  }

  async function deleteBrain(id: string, name: string, isSystem: boolean) {
    if (isSystem) { setError("Cannot delete a system brain"); return; }
    if (!confirm(`Delete brain "${name}"?`)) return;
    const res = await fetch(`/api/admin/brains/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Could not delete"); return; }
    void loadBrains(); void loadAnalytics();
  }

  /* ── knowledge CRUD ─────────────────────────────────────────── */

  function openAddForm() {
    setEditId(null); setFUserId(""); setFProjId(""); setFBrainId(""); setFTitle("");
    setFCategory(""); setFContent(""); setFormMode("add"); setError(null);
  }

  async function openEditForm(doc: KDoc) {
    setError(null);
    const res = await fetch(`/api/admin/knowledge/${doc.id}`);
    if (!res.ok) { setError("Could not load document"); return; }
    const d = await res.json().catch(() => ({}));
    const full = d.document;
    setEditId(doc.id);
    setFUserId(doc.userId);
    setFProjId(doc.projectId ?? "");
    setFBrainId(doc.brainId ?? "");
    setFTitle(full?.title ?? "");
    setFCategory(full?.category ?? "");
    setFContent(full?.content ?? "");
    setFormMode("edit");
  }

  function cancelForm() { setFormMode("hidden"); setEditId(null); setError(null); }

  async function saveKnowledge(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!fTitle.trim()) { setError("Title is required"); return; }
    if (!fContent.trim()) { setError("Content is required"); return; }
    if (formMode === "add" && !fUserId) { setError("Select a user first"); return; }
    setFSaving(true);
    try {
      let res: Response;
      if (formMode === "add") {
        res = await fetch("/api/admin/knowledge", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: fUserId, projectId: fProjId || null, brainId: fBrainId || null,
            title: fTitle, category: fCategory || null, content: fContent,
          }),
        });
      } else {
        res = await fetch(`/api/admin/knowledge/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: fTitle, category: fCategory || null, brainId: fBrainId || null, content: fContent,
          }),
        });
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Could not save"); return; }
      cancelForm(); void loadKnowledge();
    } finally { setFSaving(false); }
  }

  async function deleteKnowledge(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    const res = await fetch(`/api/admin/knowledge/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? "Could not delete"); return; }
    void loadKnowledge();
  }

  /* ── derived data ───────────────────────────────────────────── */

  const userProjects = allProjects.filter((p) => p.userId === fUserId);

  const uniqueCategories = [
    ...new Set(knowledge.map((d) => d.category).filter(Boolean)),
  ] as string[];
  const uniqueProjects = [
    ...new Map(
      knowledge
        .filter((d) => d.projectId && d.projectName)
        .map((d) => [d.projectId, { id: d.projectId!, name: d.projectName! }]),
    ).values(),
  ];

  const filteredKnowledge = knowledge.filter((d) => {
    if (kSearch && !d.title.toLowerCase().includes(kSearch.toLowerCase())) return false;
    if (kCatFilter && d.category !== kCatFilter) return false;
    if (kProjFilter && d.projectId !== kProjFilter) return false;
    if (kBrainFilter && d.brainId !== kBrainFilter) return false;
    return true;
  });

  /* ── style helpers ──────────────────────────────────────────── */

  const input = "w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";
  const tabBtn = (active: boolean) =>
    `px-4 py-2 text-sm capitalize transition-colors border-b-2 ${
      active ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  /* ── render ─────────────────────────────────────────────────── */

  if (status === "loading") return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;

  if (status === "login") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <form onSubmit={doLogin} className="w-full max-w-sm space-y-3">
          <h1 className="text-center text-2xl font-semibold">Admin Portal</h1>
          <p className="text-center text-sm text-muted-foreground">Sign in with admin credentials.</p>
          <input className={input} placeholder="Admin Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className={input} type="password" placeholder="Admin Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">Enter</button>
          <div className="text-right text-xs text-muted-foreground"><a href="/" className="hover:text-foreground">← Back to chat</a></div>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <a href="/" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Back to chat</a>
          <button onClick={logout} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Log out</button>
        </div>
      </div>

      {/* Analytics stats */}
      {analytics && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "Users", value: analytics.totalUsers },
            { label: "Conversations", value: analytics.totalConversations },
            { label: "Messages", value: analytics.totalMessages },
            { label: "Documents", value: analytics.totalDocuments },
            { label: "Chunks", value: analytics.totalChunks },
            { label: "Brains", value: analytics.totalBrains },
            { label: "Memories", value: analytics.totalMemories },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border p-3 text-center">
              <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {/* Admins card */}
      <section className="mb-8 rounded-xl border p-4">
        <h2 className="mb-3 text-sm font-semibold">Admins ({admins.length})</h2>
        <div className="mb-3 overflow-hidden rounded-lg border">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
              <span className="font-medium">{a.username}</span>
              <span className="flex gap-3">
                <button onClick={() => resetAdmin(a.id)} className="text-xs text-muted-foreground hover:text-foreground">Reset password</button>
                <button onClick={() => deleteAdmin(a.id)} className="text-xs text-destructive hover:opacity-80">Delete</button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={createAdmin} className="flex flex-col gap-2 sm:flex-row">
          <input className={input} placeholder="New admin username" value={newU} onChange={(e) => setNewU(e.target.value)} />
          <input className={input} type="password" placeholder="Password (min 8 chars)" value={newP} onChange={(e) => setNewP(e.target.value)} />
          <button className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">Create</button>
        </form>
      </section>

      {/* Data tab bar */}
      <div className="mb-0 flex gap-0 overflow-x-auto border-b">
        {(["users", "projects", "documents", "knowledge", "brains"] as DataTab[]).map((t) => (
          <button key={t} onClick={() => loadTab(t)} className={tabBtn(dataTab === t)}>
            {t === "knowledge" ? "Knowledge Base" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Users / Projects / Documents views ── */}
      {dataTab !== "knowledge" && dataTab !== "brains" && (
        <section className="mt-4">
          <div className="overflow-x-auto rounded-lg border">
            <pre className="max-h-96 overflow-auto p-3 text-xs">{JSON.stringify(dataRows, null, 2)}</pre>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{dataRows.length} record(s)</p>
        </section>
      )}

      {/* ── Brains tab ── */}
      {dataTab === "brains" && (
        <section className="mt-4">
          {/* Brain form */}
          {brainForm !== null && (
            <div className="mb-6 rounded-xl border bg-muted/30 p-5">
              <h3 className="mb-4 text-sm font-semibold">{brainEditId ? "Edit Brain" : "Add Brain"}</h3>
              <form onSubmit={saveBrain} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Name *</label>
                    <input className={input} value={brainForm.name} onChange={(e) => setBrainForm((f) => f && ({ ...f, name: e.target.value }))} placeholder="e.g. Legal Brain" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Slug *</label>
                    <input className={input} value={brainForm.slug} onChange={(e) => setBrainForm((f) => f && ({ ...f, slug: e.target.value }))} placeholder="e.g. legal" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Icon</label>
                    <input className={input} value={brainForm.icon} onChange={(e) => setBrainForm((f) => f && ({ ...f, icon: e.target.value }))} placeholder="🧠" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Color</label>
                    <input type="color" className="h-10 w-full rounded-lg border bg-background px-2" value={brainForm.color} onChange={(e) => setBrainForm((f) => f && ({ ...f, color: e.target.value }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                    <input className={input} value={brainForm.description} onChange={(e) => setBrainForm((f) => f && ({ ...f, description: e.target.value }))} placeholder="What this brain covers…" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={brainSaving} className="min-h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {brainSaving ? "Saving…" : brainEditId ? "Save" : "Create Brain"}
                  </button>
                  <button type="button" onClick={() => { setBrainForm(null); setBrainEditId(null); }} className="min-h-10 rounded-lg border px-4 text-sm hover:bg-accent">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {brainForm === null && (
            <button onClick={openBrainAdd} className="mb-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
              + Add Brain
            </button>
          )}

          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Icon</span><span>Brain</span><span className="w-16 text-center">Docs</span><span className="w-16 text-center">Chunks</span><span className="w-16 text-right">Type</span><span className="w-20 text-right">Actions</span>
            </div>
            {brains.map((b) => (
              <div key={b.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-0">
                <span className="text-xl">{b.icon}</span>
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.description ?? b.slug}</p>
                </div>
                <span className="w-16 text-center text-xs tabular-nums">{b.documentCount ?? 0}</span>
                <span className="w-16 text-center text-xs tabular-nums">{b.chunkCount ?? 0}</span>
                <span className="w-16 text-right">
                  {b.isSystem ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">System</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Custom</span>
                  )}
                </span>
                <span className="flex w-20 justify-end gap-2">
                  <button onClick={() => openBrainEdit(b)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                  {!b.isSystem && (
                    <button onClick={() => deleteBrain(b.id, b.name, b.isSystem)} className="text-xs text-destructive hover:opacity-80">Delete</button>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{brains.length} brain(s)</p>
        </section>
      )}

      {/* ── Knowledge Base tab ── */}
      {dataTab === "knowledge" && (
        <section className="mt-4">

          {/* Knowledge form (Add / Edit) */}
          {formMode !== "hidden" && (
            <div className="mb-6 rounded-xl border bg-muted/30 p-5">
              <h3 className="mb-4 text-sm font-semibold">
                {formMode === "add" ? "Add Knowledge" : "Edit Knowledge"}
              </h3>
              <form onSubmit={saveKnowledge} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">

                  {/* User (add only) */}
                  {formMode === "add" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">User *</label>
                      <select
                        className={input}
                        value={fUserId}
                        onChange={(e) => { setFUserId(e.target.value); setFProjId(""); }}
                      >
                        <option value="">Select user…</option>
                        {allUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.email ?? u.id}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Project */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Project <span className="font-normal text-muted-foreground/70">(optional)</span>
                    </label>
                    <select
                      className={input}
                      value={fProjId}
                      onChange={(e) => setFProjId(e.target.value)}
                      disabled={formMode === "add" && !fUserId}
                    >
                      <option value="">No project (user-level)</option>
                      {(formMode === "add" ? userProjects : allProjects).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Brain */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Brain <span className="font-normal text-muted-foreground/70">(optional)</span>
                    </label>
                    <select className={input} value={fBrainId} onChange={(e) => setFBrainId(e.target.value)}>
                      <option value="">No brain (global)</option>
                      {allBrainsOpt.map((b) => (
                        <option key={b.id} value={b.id}>{b.icon} {b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Title *</label>
                    <input
                      className={input}
                      placeholder="e.g. College"
                      value={fTitle}
                      onChange={(e) => setFTitle(e.target.value)}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                    <select className={input} value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
                      <option value="">None</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Content *</label>
                  <textarea
                    className={`${input} min-h-[140px] resize-y font-mono text-xs leading-relaxed`}
                    placeholder="Paste knowledge here…"
                    value={fContent}
                    onChange={(e) => setFContent(e.target.value)}
                  />
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {fContent.length.toLocaleString()} characters — automatically chunked and indexed on save.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={fSaving}
                    className="min-h-10 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {fSaving ? "Saving…" : formMode === "add" ? "Add to Knowledge Base" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="min-h-10 rounded-lg border px-4 text-sm hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Toolbar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {formMode === "hidden" && (
              <button
                onClick={openAddForm}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                + Add Knowledge
              </button>
            )}
            <input
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search by title…"
              value={kSearch}
              onChange={(e) => setKSearch(e.target.value)}
            />
            <select
              className="rounded-lg border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={kCatFilter}
              onChange={(e) => setKCatFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className="rounded-lg border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={kProjFilter}
              onChange={(e) => setKProjFilter(e.target.value)}
            >
              <option value="">All projects</option>
              {uniqueProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              className="rounded-lg border bg-background px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={kBrainFilter}
              onChange={(e) => setKBrainFilter(e.target.value)}
            >
              <option value="">All brains</option>
              {allBrainsOpt.map((b) => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}
            </select>
          </div>

          {/* Knowledge list */}
          {filteredKnowledge.length === 0 ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
              {knowledge.length === 0
                ? "No knowledge documents yet. Click \"+ Add Knowledge\" to get started."
                : "No results match your filters."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Title</span>
                <span className="w-24 text-center">Category</span>
                <span className="w-24 text-center">Brain</span>
                <span className="w-32">Project</span>
                <span className="w-24 text-right">Created</span>
                <span className="w-20 text-right">Actions</span>
              </div>

              {filteredKnowledge.map((doc) => (
                <div
                  key={doc.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{doc.userEmail ?? doc.userId}</p>
                  </div>
                  <span className="w-24 text-center">
                    {doc.category ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{doc.category}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="w-24 text-center">
                    {doc.brainName ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs">{doc.brainIcon} {doc.brainName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="w-32 truncate text-xs text-muted-foreground">
                    {doc.projectName ?? <span className="italic">User-level</span>}
                  </span>
                  <span className="w-24 text-right text-xs text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                  <span className="flex w-20 justify-end gap-2">
                    <button
                      onClick={() => openEditForm(doc)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteKnowledge(doc.id, doc.title)}
                      className="text-xs text-destructive hover:opacity-80"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {filteredKnowledge.length} of {knowledge.length} document(s)
          </p>
        </section>
      )}
    </main>
  );
}
