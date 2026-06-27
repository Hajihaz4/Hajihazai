/**
 * Brain-scoped knowledge retrieval — integration tests.
 * Verifies that brainScope() correctly isolates knowledge per brain.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ingestText } from "@/lib/knowledge/ingest";
import { buildKnowledgeContext } from "@/lib/memory/context";
import { getBrainBySlug } from "@/lib/db/brain-queries";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("brain-scoped knowledge retrieval (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any, schema: any;
  let userId = "";
  let hajiCoreId = "";
  let legalId = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    userId = (
      await db.insert(schema.users).values({ email: `bscope-${s}@x.com` }).returning()
    )[0].id;

    const hajiCoreBrain = await getBrainBySlug("haji-core");
    const legalBrain = await getBrainBySlug("legal");
    hajiCoreId = hajiCoreBrain?.id ?? "";
    legalId = legalBrain?.id ?? "";

    // Ingest into Haji Core brain.
    await ingestText(userId, {
      title: "Personal Profile",
      content: "Haji was born in Nagore. His goal is to build successful businesses.",
      projectId: null,
      brainId: hajiCoreId,
    });

    // Ingest into Legal brain.
    await ingestText(userId, {
      title: "Company Law Notes",
      content: "The Companies Act 2013 governs corporate entities in India. Section 2 defines a company.",
      projectId: null,
      brainId: legalId,
    });

    // Ingest with no brain (global).
    await ingestText(userId, {
      title: "General Knowledge",
      content: "This document belongs to no specific brain and should be visible everywhere.",
      projectId: null,
      brainId: null,
    });
  });

  afterAll(async () => {
    if (!db || !userId) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
  });

  it("haji-core brain finds personal docs + global docs", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "Who is Haji and where was he born?",
      brainId: hajiCoreId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("Nagore");
  });

  it("legal brain finds legal docs + global docs", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "What does the Companies Act say?",
      brainId: legalId,
    });
    expect(k.count).toBeGreaterThan(0);
    expect(k.block).toContain("Companies Act");
  });

  it("legal brain does NOT return haji-core-only docs", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "Where was Haji born?",
      brainId: legalId,
    });
    // "Nagore" is only in Haji Core brain — should not appear in Legal brain search.
    expect(k.block).not.toContain("Nagore");
  });

  it("haji-core brain does NOT return legal-only docs", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "What does the Companies Act say about Section 2?",
      brainId: hajiCoreId,
    });
    // Companies Act only in Legal brain — should not appear in Haji Core search.
    expect(k.block).not.toContain("Companies Act");
  });

  it("no brain filter finds all docs", async () => {
    const k1 = await buildKnowledgeContext(userId, {
      query: "Haji born Nagore",
      brainId: undefined,
    });
    expect(k1.block).toContain("Nagore");

    const k2 = await buildKnowledgeContext(userId, {
      query: "Companies Act",
      brainId: undefined,
    });
    expect(k2.block).toContain("Companies Act");
  });

  it("global docs appear in any brain context", async () => {
    const k = await buildKnowledgeContext(userId, {
      query: "general document brain",
      brainId: hajiCoreId,
    });
    expect(k.block).toContain("no specific brain");
  });
});
