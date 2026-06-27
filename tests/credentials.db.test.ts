import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("username/password credentials + reset (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, cq: any, pw: any;
  let userId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    cq = await import("@/lib/db/credential-queries");
    pw = await import("@/lib/auth/password");
  });

  afterAll(async () => {
    if (!db || !userId) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
  });

  it("creates a password user and logs in by username OR email", async () => {
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const username = `pwuser_${s}`;
    const email = `pw-${s}@example.com`;
    const hash = await pw.hashPassword("Sup3rSecret!");
    const r = await cq.createPasswordUser({ username, email, passwordHash: hash });
    expect(r.ok).toBe(true);
    if (r.ok) userId = r.userId;

    const byU = await cq.getLoginProfile(username);
    expect(byU?.userId).toBe(userId);
    const byE = await cq.getLoginProfile(email.toUpperCase());
    expect(byE?.userId).toBe(userId);
    expect(await pw.verifyPassword("Sup3rSecret!", byU.passwordHash)).toBe(true);
  });

  it("reset token is single-use and honours expiry", async () => {
    const good = pw.generateToken();
    await cq.createResetToken(userId, good.tokenHash, new Date(Date.now() + 60_000));
    expect(await cq.consumeResetToken(pw.hashToken(good.token))).toBe(userId);
    // Second use fails.
    expect(await cq.consumeResetToken(pw.hashToken(good.token))).toBeNull();

    const expired = pw.generateToken();
    await cq.createResetToken(userId, expired.tokenHash, new Date(Date.now() - 1000));
    expect(await cq.consumeResetToken(pw.hashToken(expired.token))).toBeNull();
  });
});
