import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("project navigation + chat ownership (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, q: any, pq: any;
  let A = "", B = "", p1 = "", p2 = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    q = await import("@/lib/db/queries");
    pq = await import("@/lib/db/project-queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (e: string) =>
      (await db.insert(schema.users).values({ email: e }).returning())[0].id;
    A = await mk(`pn-A-${s}@x.com`);
    B = await mk(`pn-B-${s}@x.com`);
    p1 = (await pq.createProject(A, { name: "P1" })).id;
    p2 = (await pq.createProject(A, { name: "P2" })).id;
  });

  afterAll(async () => {
    if (!db || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("creates a chat inside a project and lists it under that project only", async () => {
    const conv = await q.createConversation(A, "Project chat", p1);
    expect(conv.projectId).toBe(p1);

    const inP1 = await q.listProjectConversations(A, p1);
    expect(inP1.some((c: any) => c.id === conv.id)).toBe(true);

    const inP2 = await q.listProjectConversations(A, p2);
    expect(inP2.some((c: any) => c.id === conv.id)).toBe(false);
  });

  it("never lists another user's project chats", async () => {
    await q.createConversation(A, "A's chat", p1);
    const asB = await q.listProjectConversations(B, p1);
    expect(asB.length).toBe(0);
  });

  it("detaches chats to Recent Chats when their project is deleted", async () => {
    const conv = await q.createConversation(A, "to detach", p2);
    expect(await pq.deleteProject(A, p2)).toBe(true);
    const [row] = await db
      .select()
      .from(schema.conversations)
      .where((await import("drizzle-orm")).eq(schema.conversations.id, conv.id));
    expect(row.projectId).toBeNull();
  });
});
