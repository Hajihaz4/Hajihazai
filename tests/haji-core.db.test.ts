import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Haji Core — system project knowledge loads globally (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, pq: any, ing: any, ctx: any;
  let userId = "";
  let coreProjectId = "";
  let regularProjectId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    pq = await import("@/lib/db/project-queries");
    ing = await import("@/lib/knowledge/ingest");
    ctx = await import("@/lib/memory/context");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    userId = (
      await db.insert(schema.users).values({ email: `hc-${s}@x.com` }).returning()
    )[0].id;

    // Haji Core — system project (isSystem = true).
    coreProjectId = (
      await pq.createProject(userId, { name: "Haji Core", isSystem: true })
    ).id;

    // A regular project (isSystem = false).
    regularProjectId = (
      await pq.createProject(userId, { name: "Law School", isSystem: false })
    ).id;

    // Add knowledge only to Haji Core.
    await ing.ingestText(userId, {
      title: "Haji Identity",
      content:
        "Haji's full name is Muzammil. He studies LLB at SRM School of Law, Kattankulathur. His favourite colour is black.",
      projectId: coreProjectId,
      category: "Personal",
    });
  });

  afterAll(async () => {
    if (!db || !userId) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
  });

  it("loads Haji Core knowledge in a non-project (user-level) chat", async () => {
    const k = await ctx.buildKnowledgeContext(userId, {
      query: "What is Haji's favourite colour?",
      projectId: null,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("black");
  });

  it("loads Haji Core knowledge inside a regular project chat", async () => {
    const k = await ctx.buildKnowledgeContext(userId, {
      query: "Where does Haji study?",
      projectId: regularProjectId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("SRM School of Law");
  });

  it("does NOT double-count when the active project IS Haji Core", async () => {
    const k = await ctx.buildKnowledgeContext(userId, {
      query: "What is Haji's full name?",
      projectId: coreProjectId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("Muzammil");
    // All chunks should be unique (no duplicates from double-search).
    const ids = k.chunks.map((c: any) => c.chunkId);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it("system project flag is stored correctly", async () => {
    const systemProjects = await pq.listSystemProjects(userId);
    const regular = await pq.listProjects(userId);
    expect(systemProjects).toHaveLength(1);
    expect(systemProjects[0].id).toBe(coreProjectId);
    expect(systemProjects[0].isSystem).toBe(true);
    // Both projects appear in the full list.
    expect(regular.length).toBe(2);
  });
});
