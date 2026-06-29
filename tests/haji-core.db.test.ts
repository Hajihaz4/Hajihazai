/**
 * Haji Core global knowledge tests.
 *
 * Since migration 0016 the system-project mechanism is replaced by
 * visibility='global'. This test suite verifies the new behaviour:
 * global documents are retrieved for ANY authenticated user, regardless
 * of which project or account is active.
 *
 * The old "system project" test was removed because that code path
 * (listSystemProjects loop) was deleted from buildKnowledgeContext as
 * part of the Global Knowledge Layer refactor.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Haji Core — global knowledge loads for any user (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, ctx: any, pq: any;
  let ownerUserId = "";
  let guestUserId = "";
  let guestProjId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    ctx = await import("@/lib/memory/context");
    pq = await import("@/lib/db/project-queries");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

    // ownerUserId creates the global doc.
    ownerUserId = (
      await db.insert(schema.users).values({ email: `hc-owner-${s}@x.com` }).returning()
    )[0].id;

    // guestUserId never created any doc but should still see global knowledge.
    guestUserId = (
      await db.insert(schema.users).values({ email: `hc-guest-${s}@x.com` }).returning()
    )[0].id;

    // Guest has their own project (no Haji knowledge in it).
    guestProjId = (await pq.createProject(guestUserId, { name: "Guest Project" })).id;

    // Create a global document under owner.
    await db.insert(schema.knowledgeDocument).values({
      userId: ownerUserId,
      title: "Haji Colour Fact",
      status: "active",
      visibility: "global",
      sourceType: "note",
    }).returning().then(async ([doc]: any[]) => {
      await db.insert(schema.knowledgeChunk).values({
        documentId: doc.id,
        userId: ownerUserId,
        content: "Haji's favourite colour is chartreuse-xk7. He was born in Nagapattinam.",
        chunkIndex: 0,
      });
    });
  });

  afterAll(async () => {
    if (!db || !ownerUserId) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(
      inArray(schema.users.id, [ownerUserId, guestUserId]),
    );
  });

  it("owner retrieves own global doc in a non-project chat", async () => {
    const k = await ctx.buildKnowledgeContext(ownerUserId, {
      query: "What is Haji's favourite colour?",
      projectId: null,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("chartreuse-xk7");
  });

  it("guest user retrieves global doc they did NOT create", async () => {
    const k = await ctx.buildKnowledgeContext(guestUserId, {
      query: "What is Haji's favourite colour?",
      projectId: null,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("chartreuse-xk7");
  });

  it("global doc appears inside a guest project chat too", async () => {
    const k = await ctx.buildKnowledgeContext(guestUserId, {
      query: "Where was Haji born?",
      projectId: guestProjId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("Nagapattinam");
  });

  it("all returned chunks are unique (no duplicate global docs)", async () => {
    const k = await ctx.buildKnowledgeContext(guestUserId, {
      query: "Haji chartreuse Nagapattinam",
      projectId: null,
    });
    const ids = k.chunks.map((c: any) => c.chunkId);
    expect(ids.length).toBe(new Set(ids).size);
  });
});
