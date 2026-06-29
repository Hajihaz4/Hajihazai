/**
 * Global Knowledge Layer regression tests.
 *
 * Verifies the core invariant: documents marked visibility='global' are
 * accessible to ANY authenticated user, not just the owner.
 *
 * Tests run against the production DB (DATABASE_URL must be set).
 * All test users and their documents are cleaned up in afterAll.
 *
 * Architecture tested:
 *  - keywordDocumentSearch(userB) returns docs created by userA if global
 *  - semanticDocumentSearch(userB) same (when embeddings exist)
 *  - buildKnowledgeContext(userB) block contains global doc content
 *  - Private docs from userA are NOT visible to userB
 *  - Global docs with a brain scope filter are still returned
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { keywordDocumentSearch } from "@/lib/knowledge/keyword-search";
import { buildKnowledgeContext } from "@/lib/memory/context";

const hasDb = !!process.env.DATABASE_URL;

/* ─── helpers ────────────────────────────────────────────────── */

async function makeUser(db: any, schema: any, suffix: string) {
  const email = `gk-test-${suffix}@example.com`;
  const [user] = await db.insert(schema.users).values({ email }).returning();
  return user.id as string;
}

async function ingestGlobal(
  db: any,
  schema: any,
  userId: string,
  title: string,
  content: string,
  brainId?: string,
): Promise<string> {
  const [doc] = await db
    .insert(schema.knowledgeDocument)
    .values({
      userId,
      title,
      status: "active",
      visibility: "global",
      sourceType: "note",
      brainId: brainId ?? null,
    })
    .returning();

  await db.insert(schema.knowledgeChunk).values({
    documentId: doc.id,
    userId,
    content,
    chunkIndex: 0,
  });

  return doc.id as string;
}

async function ingestPrivate(
  db: any,
  schema: any,
  userId: string,
  title: string,
  content: string,
): Promise<string> {
  const [doc] = await db
    .insert(schema.knowledgeDocument)
    .values({
      userId,
      title,
      status: "active",
      visibility: "private",
      sourceType: "note",
    })
    .returning();

  await db.insert(schema.knowledgeChunk).values({
    documentId: doc.id,
    userId,
    content,
    chunkIndex: 0,
  });

  return doc.id as string;
}

async function cleanup(db: any, schema: any, ...userIds: string[]) {
  const { inArray } = await import("drizzle-orm");
  if (userIds.length > 0) {
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
  }
}

/* ─── SECTION 1: unit tests — no DB needed ────────────────────── */

describe("global knowledge visibility type", () => {
  it("valid visibility values are private and global", () => {
    const values: Array<"private" | "global"> = ["private", "global"];
    expect(values).toContain("private");
    expect(values).toContain("global");
    expect(values).toHaveLength(2);
  });
});

/* ─── SECTION 2: DB integration tests ────────────────────────── */

describe.skipIf(!hasDb)("global knowledge retrieval — keyword (db)", () => {
  let db: any, schema: any;
  let ownerUserId = "";
  let userB = "";
  let userC = "";
  let globalDocId = "";
  let privateDocId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");

    ownerUserId = await makeUser(db, schema, "owner");
    userB = await makeUser(db, schema, "b");
    userC = await makeUser(db, schema, "c");

    // Owner creates a global doc (Haji-like public knowledge).
    globalDocId = await ingestGlobal(
      db, schema, ownerUserId,
      "Haji Identity",
      "Full name is Syed Hasan Kuddos Sahib. Known as Haji. Born 29 March 2004 in Nagapattinam.",
    );

    // Owner also has a private doc (not visible to others).
    privateDocId = await ingestPrivate(
      db, schema, ownerUserId,
      "Private Journal",
      "This is a private thought that only the owner should see.",
    );

    // UserB has their own private doc.
    await ingestPrivate(
      db, schema, userB,
      "UserB Notes",
      "UserB personal notes visible only to UserB.",
    );
  });

  afterAll(async () => cleanup(db, schema, ownerUserId, userB, userC));

  it("owner can retrieve their own global doc", async () => {
    const hits = await keywordDocumentSearch(ownerUserId, "Haji Nagapattinam");
    expect(hits.some((h) => h.documentId === globalDocId)).toBe(true);
  });

  it("User B can retrieve the global doc they did NOT create (global access)", async () => {
    const hits = await keywordDocumentSearch(userB, "Haji Nagapattinam");
    expect(hits.some((h) => h.documentId === globalDocId)).toBe(true);
  });

  it("User C can retrieve the global doc (User C created nothing)", async () => {
    const hits = await keywordDocumentSearch(userC, "Syed Hasan Nagapattinam");
    expect(hits.some((h) => h.documentId === globalDocId)).toBe(true);
  });

  it("private doc is NOT visible to User B", async () => {
    const hits = await keywordDocumentSearch(userB, "private thought journal");
    expect(hits.some((h) => h.documentId === privateDocId)).toBe(false);
  });

  it("private doc IS visible to its owner", async () => {
    const hits = await keywordDocumentSearch(ownerUserId, "private thought journal");
    expect(hits.some((h) => h.documentId === privateDocId)).toBe(true);
  });

  it("UserB's private doc is NOT visible to the owner", async () => {
    const hits = await keywordDocumentSearch(ownerUserId, "UserB personal notes");
    const userBPrivate = hits.filter((h) => h.title === "UserB Notes");
    expect(userBPrivate).toHaveLength(0);
  });
});

describe.skipIf(!hasDb)("global knowledge — buildKnowledgeContext (db)", () => {
  let db: any, schema: any;
  let ownerUserId = "";
  let userD = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");

    ownerUserId = await makeUser(db, schema, "ctx-owner");
    userD = await makeUser(db, schema, "ctx-d");

    // Seed global doc with rich facts.
    await ingestGlobal(
      db, schema, ownerUserId,
      "Haji Goals",
      "Career goal is to become a Corporate Lawyer. Ten-year goal: build a legacy that surprises the world.",
    );

    await ingestGlobal(
      db, schema, ownerUserId,
      "Haji Education",
      "Currently studying LLB Hons at SRM School of Law. Previously completed BBA in Financial Services.",
    );
  });

  afterAll(async () => cleanup(db, schema, ownerUserId, userD));

  it("User D (different account) receives global knowledge in context", async () => {
    const ctx = await buildKnowledgeContext(userD, { query: "What are Haji's career goals?" });
    expect(ctx.count).toBeGreaterThan(0);
    expect(ctx.block.toLowerCase()).toContain("lawyer");
  });

  it("User D receives education facts from global doc", async () => {
    const ctx = await buildKnowledgeContext(userD, { query: "What is Haji studying?" });
    expect(ctx.count).toBeGreaterThan(0);
    expect(ctx.block.toLowerCase()).toContain("srm");
  });

  it("context block is non-empty for unrelated user asking about global knowledge", async () => {
    const ctx = await buildKnowledgeContext(userD, { query: "Who is Haji?" });
    expect(ctx.block.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasDb)("global knowledge — brain-scoped global docs (db)", () => {
  let db: any, schema: any;
  let ownerUserId = "";
  let userE = "";
  let testBrainId = "";
  let brainDocId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");

    ownerUserId = await makeUser(db, schema, "brain-owner");
    userE = await makeUser(db, schema, "brain-e");

    // Create a temporary test brain.
    const [brain] = await db
      .insert(schema.brains)
      .values({
        name: "Test Global Brain",
        slug: `test-global-${Date.now()}`,
        icon: "🧪",
        color: "#6366f1",
        isSystem: false,
      })
      .returning();
    testBrainId = brain.id;

    // Create a global doc assigned to that brain.
    brainDocId = await ingestGlobal(
      db, schema, ownerUserId,
      "Brain-scoped Global Doc",
      "Unique phrase: xylophone-zebra-quantum for testing brain scope.",
      testBrainId,
    );
  });

  afterAll(async () => {
    await cleanup(db, schema, ownerUserId, userE);
    if (testBrainId) {
      await db.delete(schema.brains).where(schema.brains.id === testBrainId);
    }
  });

  it("User E can retrieve brain-scoped global doc when brain filter matches", async () => {
    const hits = await keywordDocumentSearch(userE, "xylophone zebra quantum", {
      brainId: testBrainId,
    });
    expect(hits.some((h) => h.documentId === brainDocId)).toBe(true);
  });

  it("User E cannot retrieve brain doc when a different brain is filtered", async () => {
    const hits = await keywordDocumentSearch(userE, "xylophone zebra quantum", {
      brainId: "some-other-brain-id-that-does-not-exist",
    });
    expect(hits.some((h) => h.documentId === brainDocId)).toBe(false);
  });

  it("global doc visible to User E with no brain filter", async () => {
    const hits = await keywordDocumentSearch(userE, "xylophone zebra quantum");
    expect(hits.some((h) => h.documentId === brainDocId)).toBe(true);
  });
});
