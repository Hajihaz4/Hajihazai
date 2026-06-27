import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("renameConversation ownership (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let q: any;
  let A = "";
  let B = "";
  let convId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    q = await import("@/lib/db/queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (email: string) =>
      (await db.insert(schema.users).values({ email }).returning())[0].id;
    A = await mk(`rn-A-${s}@example.com`);
    B = await mk(`rn-B-${s}@example.com`);
    convId = (
      await db
        .insert(schema.conversations)
        .values({ userId: A, title: "Original" })
        .returning()
    )[0].id;
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("renames the owner's conversation", async () => {
    const row = await q.renameConversation(A, convId, "Renamed Title");
    expect(row?.title).toBe("Renamed Title");
  });

  it("refuses to rename a conversation owned by another user", async () => {
    const result = await q.renameConversation(B, convId, "Hacked");
    expect(result).toBeNull();
    // Title is unchanged.
    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where((await import("drizzle-orm")).eq(schema.conversations.id, convId));
    expect(conv.title).toBe("Renamed Title");
  });
});
