import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("admin auth (db, DB-driven — no ADMIN_EMAILS)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, aq: any, pw: any;
  const ids: string[] = [];

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    aq = await import("@/lib/admin/queries");
    pw = await import("@/lib/auth/password");
  });

  afterAll(async () => {
    if (!db || ids.length === 0) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.admins).where(inArray(schema.admins.id, ids));
  });

  it("creates an admin, finds by username, and verifies the password", async () => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const username = `adm_${s}`;
    const r = await aq.createAdmin({
      username,
      passwordHash: await pw.hashPassword("AdminPass1"),
    });
    expect(r.ok).toBe(true);
    if (r.ok) ids.push(r.id);

    const a = await aq.getAdminByUsername(username);
    expect(a?.username).toBe(username);
    expect(await pw.verifyPassword("AdminPass1", a.passwordHash)).toBe(true);
    expect(await pw.verifyPassword("wrong", a.passwordHash)).toBe(false);
  });

  it("rejects duplicate admin usernames", async () => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const username = `dup_${s}`;
    const r1 = await aq.createAdmin({ username, passwordHash: "scrypt:0:0" });
    if (r1.ok) ids.push(r1.id);
    const r2 = await aq.createAdmin({ username, passwordHash: "scrypt:0:0" });
    expect(r2.ok).toBe(false);
  });

  it("listAdmins never exposes password hashes", async () => {
    const list = await aq.listAdmins();
    expect(list.every((a: any) => !("passwordHash" in a))).toBe(true);
  });
});
