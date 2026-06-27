"use client";

import { useState } from "react";

type Initial = {
  username: string | null;
  email: string;
  name: string | null;
  createdAt: string;
  hasPassword: boolean;
};

export default function ProfileForm({ initial }: { initial: Initial }) {
  const [username, setUsername] = useState(initial.username ?? "");
  const [unameMsg, setUnameMsg] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const input =
    "w-full rounded-lg border bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring sm:text-sm";
  const created = new Date(initial.createdAt).toLocaleDateString();

  async function saveUsername(e: React.FormEvent) {
    e.preventDefault();
    setUnameMsg(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    setUnameMsg(res.ok ? "Username updated" : data.error ?? "Update failed");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPwMsg("Password updated");
      setCurrentPassword("");
      setPassword("");
    } else {
      setPwMsg(data.error ?? "Update failed");
    }
  }

  return (
    <div className="space-y-8">
      {/* Account info */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="rounded-lg border p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Email</span>
            <span>{initial.email}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Member since</span>
            <span>{created}</span>
          </div>
        </div>
      </section>

      {/* Profile picture (storage not configured yet) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Profile picture</h2>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled className="text-sm" />
        <p className="text-xs text-muted-foreground">
          Image uploads activate once storage is configured.
        </p>
      </section>

      {/* Username */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Username</h2>
        <form onSubmit={saveUsername} className="flex flex-col gap-2 sm:flex-row">
          <input
            className={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
          <button className="min-h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            Save
          </button>
        </form>
        {unameMsg ? <p className="text-xs text-muted-foreground">{unameMsg}</p> : null}
      </section>

      {/* Password */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          {initial.hasPassword ? "Change password" : "Set a password"}
        </h2>
        <form onSubmit={savePassword} className="flex flex-col gap-2">
          {initial.hasPassword ? (
            <input
              className={input}
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          ) : null}
          <input
            className={input}
            type="password"
            autoComplete="new-password"
            placeholder="New password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            {initial.hasPassword ? "Update password" : "Set password"}
          </button>
        </form>
        {pwMsg ? <p className="text-xs text-muted-foreground">{pwMsg}</p> : null}
      </section>
    </div>
  );
}
