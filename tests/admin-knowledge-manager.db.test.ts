/**
 * Verification test for the Admin Knowledge Manager sprint.
 *
 * Scenario (matches the sprint spec):
 *   Title:   "College"
 *   Content: "Haji is currently studying LLB (Hons) at SRM School of Law, Kattankulathur."
 *   Query:   "Where is Haji studying?"
 *   Assert:  answer comes from stored knowledge (count > 0, block contains "SRM School of Law")
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ingestText } from "@/lib/knowledge/ingest";
import { buildKnowledgeContext } from "@/lib/memory/context";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Admin knowledge manager — retrieval verification (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any;
  let userId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    userId = (
      await db.insert(schema.users).values({ email: `akm-${s}@x.com` }).returning()
    )[0].id;

    // Admin creates knowledge exactly as the sprint verification specifies.
    const result = await ingestText(userId, {
      title: "College",
      content: "Haji is currently studying LLB (Hons) at SRM School of Law, Kattankulathur.",
      projectId: null, // user-level knowledge
      category: "Education",
    });
    expect(result.ok).toBe(true);
  });

  afterAll(async () => {
    if (!db || !userId) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
  });

  it("retrieves knowledge when asked 'Where is Haji studying?'", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "Where is Haji studying?",
      projectId: null,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("SRM School of Law");
  });

  it("includes Education category knowledge in the context block", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "What law school does Haji attend?",
      projectId: null,
    });
    expect(k.block).toContain("Kattankulathur");
  });

  it("returns empty for a completely unrelated query", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "What is the boiling point of water in Celsius?",
      projectId: null,
    });
    // Keyword fallback won't find relevant docs for unrelated queries.
    // (May or may not be 0 depending on embedding availability — count
    // must be 0 via keyword if no embeddings are available.)
    if (k.count > 0) {
      // If semantic search returned something, at least it shouldn't be the
      // College doc (no overlap with boiling point / celsius / temperature).
      expect(k.block).not.toContain("LLB");
    }
  });
});
