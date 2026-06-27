import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tokenize } from "@/lib/knowledge/keyword-search";

describe("keyword tokenizer", () => {
  it("keeps content words and drops stopwords", () => {
    const t = tokenize("Which college does Haji study at?");
    expect(t).toContain("haji");
    expect(t).toContain("college");
    expect(t).not.toContain("which");
    expect(t).not.toContain("does");
    expect(t).not.toContain("at");
  });
});

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("knowledge retrieval — overrides hallucination (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any, ing: any, ctx: any, pq: any;
  let A = "", projId = "", otherProjId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    ing = await import("@/lib/knowledge/ingest");
    ctx = await import("@/lib/memory/context");
    pq = await import("@/lib/db/project-queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    A = (await db.insert(schema.users).values({ email: `kr-${s}@x.com` }).returning())[0].id;
    projId = (await pq.createProject(A, { name: "Personal" })).id;
    otherProjId = (await pq.createProject(A, { name: "Law" })).id;

    await ing.ingestDocument(A, {
      filename: "haji.txt",
      buffer: Buffer.from(
        "Haji studies LLB (Hons) at SRM School of Law, Kattankulathur.",
      ),
      projectId: projId,
      title: "About Haji",
    });
  });

  afterAll(async () => {
    if (!db || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A]));
  });

  it("retrieves the answer from project knowledge (keyword fallback works without embeddings)", async () => {
    const k = await ctx.buildKnowledgeContext(A, {
      query: "Which college does Haji study at?",
      projectId: projId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("SRM School of Law");
  });

  it("does NOT leak knowledge across projects", async () => {
    const other = await ctx.buildKnowledgeContext(A, {
      query: "Which college does Haji study at?",
      projectId: otherProjId,
    });
    expect(other.count).toBe(0);
    expect(other.block).toBe("");
  });

  it("does NOT surface project knowledge in a user-level (non-project) chat", async () => {
    const userLevel = await ctx.buildKnowledgeContext(A, {
      query: "Which college does Haji study at?",
      projectId: null,
    });
    expect(userLevel.count).toBe(0);
  });
});
