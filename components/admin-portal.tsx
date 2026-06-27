"use client";

import { useEffect, useState } from "react";

type AdminRow = { id: string; username: string; createdAt: string; createdBy: string | null };
type View = "users" | "projects" | "documents";

export default function AdminPortal() {
  const [status, setStatus] = useState<"loading" | "login" | "dashboard">("loading");
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [view, setView] = useState<View>("users");
  const [error, setError] = useState<string | null>(null);

  // Login form.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // New-admin form.
  const [newU, setNewU] = useState("");
  const [newP, setNewP] = useState("");

  useEffect(() => {
    void loadAdmins(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAdmins(initial = false) {
    const res = await fetch("/api/admin/admins");
    if (res.status === 401) {
      setStatus("login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setAdmins(data.admins ?? []);
    setStatus("dashboard");
    if (initial) void loadView("users");
  }

  async function loadView(v: View) {
    setView(v);
    const res = await fetch(`/api/admin/data?view=${v}`);
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setRows((data[v] as Record<string, unknown>[]) ?? []);
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    setPassword("");
    void loadAdmins(true);
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: newU, password: newP }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not create admin");
      return;
    }
    setNewU("");
    setNewP("");
    void loadAdmins();
  }

  async function deleteAdmin(id: string) {
    if (!confirm("Delete this admin?")) return;
    const res = await fetch(`/api/admin/admins/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete");
      return;
    }
    void loadAdmins();
  }

  async function resetAdmin(id: string) {
    const pw = prompt("New password (min 8 chars):");
    if (!pw) return;
    const res = await fetch(`/api/admin/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    setError(res.ok ? null : data.error ?? "Could not reset");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setStatus("login");
  }

  const input =
    "w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";

  if (status === "loading") {
    return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  }

  if (status === "login") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-6">
        <form onSubmit={doLogin} className="w-full max-w-sm space-y-3">
          <h1 className="text-center text-2xl font-semibold">Admin Portal</h1>
          <p className="text-center text-sm text-muted-foreground">
            Sign in with admin credentials.
          </p>
          <input
            className={input}
            placeholder="Admin Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className={input}
            type="password"
            placeholder="Admin Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <button className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            Enter
          </button>
          <div className="text-right text-xs text-muted-foreground">
            <a href="/" className="hover:text-foreground">← Back to chat</a>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <a href="/" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">Back to chat</a>
          <button onClick={logout} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">
            Log out
          </button>
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      {/* Admins */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold">Admins ({admins.length})</h2>
        <div className="overflow-hidden rounded-lg border">
          {admins.map((a) => (
            <div key={a.id} className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
              <span>{a.username}</span>
              <span className="flex gap-2">
                <button onClick={() => resetAdmin(a.id)} className="text-xs text-muted-foreground hover:text-foreground">
                  Reset password
                </button>
                <button onClick={() => deleteAdmin(a.id)} className="text-xs text-destructive hover:opacity-80">
                  Delete
                </button>
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={createAdmin} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input className={input} placeholder="New admin username" value={newU} onChange={(e) => setNewU(e.target.value)} />
          <input className={input} type="password" placeholder="Password" value={newP} onChange={(e) => setNewP(e.target.value)} />
          <button className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            Create admin
          </button>
        </form>
      </section>

      {/* Data views */}
      <section>
        <div className="mb-2 flex gap-2">
          {(["users", "projects", "documents"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => loadView(v)}
              className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                view === v ? "bg-accent" : "hover:bg-accent"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <pre className="max-h-96 overflow-auto p-3 text-xs">
            {JSON.stringify(rows, null, 2)}
          </pre>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{rows.length} record(s)</p>
      </section>
    </main>
  );
}
