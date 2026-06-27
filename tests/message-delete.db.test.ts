import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("deleteMessage ownership (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let q: any;
  let A = "";
  let B = "";
  let msgId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    q = await import("@/lib/db/queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (email: string) =>
      (await db.insert(schema.users).values({ email }).returning())[0].id;
    A = await mk(`dm-A-${s}@example.com`);
    B = await mk(`dm-B-${s}@example.com`);
    const conv = (
      await db
        .insert(schema.conversations)
        .values({ userId: A, title: "c" })
        .returning()
    )[0].id;
    msgId = (
      await db
        .insert(schema.messages)
        .values({ conversationId: conv, role: "user", content: "hi" })
        .returning()
    )[0].id;
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("refuses to delete another user's message", async () => {
    expect(await q.deleteMessage(B, msgId)).toBe(false);
  });

  it("deletes the owner's message (and is idempotent)", async () => {
    expect(await q.deleteMessage(A, msgId)).toBe(true);
    expect(await q.deleteMessage(A, msgId)).toBe(false);
  });
});
