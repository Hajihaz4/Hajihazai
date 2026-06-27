import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("projects ownership (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, pq: any;
  let A = "", B = "", projId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    pq = await import("@/lib/db/project-queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (e: string) =>
      (await db.insert(schema.users).values({ email: e }).returning())[0].id;
    A = await mk(`pj-A-${s}@x.com`);
    B = await mk(`pj-B-${s}@x.com`);
  });

  afterAll(async () => {
    if (!db || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("creates and lists the owner's projects", async () => {
    const p = await pq.createProject(A, { name: "Law", description: "legal" });
    projId = p.id;
    expect(p.name).toBe("Law");
    const list = await pq.listProjects(A);
    expect(list.some((x: any) => x.id === projId)).toBe(true);
  });

  it("isolates projects across users", async () => {
    expect(await pq.getProject(B, projId)).toBeNull();
    expect(await pq.updateProject(B, projId, { name: "hax" })).toBeNull();
    expect(await pq.deleteProject(B, projId)).toBe(false);
  });

  it("lets the owner update and delete", async () => {
    const u = await pq.updateProject(A, projId, { name: "Law v2" });
    expect(u?.name).toBe("Law v2");
    expect(await pq.deleteProject(A, projId)).toBe(true);
    expect(await pq.getProject(A, projId)).toBeNull();
  });

  it("only assigns a chat to a project the user owns", async () => {
    const proj = await pq.createProject(A, { name: "Personal" });
    const conv = (
      await db
        .insert(schema.conversations)
        .values({ userId: A, title: "c" })
        .returning()
    )[0];
    expect(await pq.assignConversationToProject(A, conv.id, proj.id)).toBe(true);
    // B cannot move A's chat.
    expect(await pq.assignConversationToProject(B, conv.id, proj.id)).toBe(false);
  });
});
