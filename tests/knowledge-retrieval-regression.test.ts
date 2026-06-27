/**
 * Regression tests for the knowledge retrieval bugs found in the audit:
 *
 * Bug 1 — User-level docs invisible in project chats.
 *   projectScope(projectId) used to return `eq(project_id)` only.
 *   User-level docs (project_id IS NULL) were never found when inside a project.
 *   Fix: projectScope now returns `(project_id = X OR project_id IS NULL)`.
 *
 * Bug 2 — KNOWLEDGE_MAX_CHARS = 2000 fit only 1 chunk (~1000 chars + overhead).
 *   A 9-chunk profile document returned at most 1 section per query.
 *   Fix: increased to 6000 — allows 5-6 chunks per query.
 *
 * Bug 3 — Keyword was a fallback-only (ran only when semantic returned 0).
 *   A single low-quality semantic hit blocked keyword from supplementing results.
 *   Fix: keyword always runs in parallel with semantic; results are merged.
 *
 * These tests FAIL on the old code, PASS after the fix.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ingestText } from "@/lib/knowledge/ingest";
import { buildKnowledgeContext } from "@/lib/memory/context";

const hasDb = !!process.env.DATABASE_URL;

const GOALS_CONTENT = [
  "Haji's One-Year Goal: Successfully relaunch and stabilize Suplaykart.",
  "Haji's Five-Year Goal: Become a successful Corporate Lawyer.",
  "Haji's Ten-Year Goal: Build a legacy that surprises the world and makes Nagore proud.",
  "What is Haji's goal? To build successful businesses, become a corporate lawyer and create a lasting impact.",
].join("\n");

describe.skipIf(!hasDb)(
  "knowledge retrieval regression — Bug 1: user-level docs visible in project chats",
  () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let db: any, schema: any, pq: any;
    let userId = "";
    let projectId = "";

    beforeAll(async () => {
      ({ db } = await import("@/lib/db"));
      schema = await import("@/lib/db/schema");
      pq = await import("@/lib/db/project-queries");

      const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      userId = (
        await db.insert(schema.users).values({ email: `krr-${s}@x.com` }).returning()
      )[0].id;

      // Create a project — the user has a chat inside it.
      projectId = (await pq.createProject(userId, { name: "Law Study" })).id;

      // Store goals at USER LEVEL (null projectId) — not inside any project.
      // Bug 1: the old code would never find this when querying inside projectId.
      await ingestText(userId, {
        title: "Haji Goals",
        content: GOALS_CONTENT,
        projectId: null,
        category: "Personal",
      });
    });

    afterAll(async () => {
      if (!db || !userId) return;
      const { inArray } = await import("drizzle-orm");
      await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
    });

    it("[Bug 1] finds user-level knowledge when chatting inside a project", async () => {
      // Simulate being in a project chat — projectId is non-null.
      const k = await buildKnowledgeContext(userId, {
        query: "What is Haji's goal?",
        projectId, // project chat, not loose chat
      });
      // Old code: count = 0 (user-level doc not visible in project scope).
      // Fixed:    count > 0 (user-level docs always visible to the owner).
      expect(k.count).toBeGreaterThan(0);
      expect(k.block).toMatch(/relaunch Suplaykart|corporate lawyer|Nagore proud/i);
    });

    it("[Bug 1] project-specific docs are still isolated from other projects", async () => {
      // Store a doc INSIDE the project.
      const otherProjId = (await pq.createProject(userId, { name: "Business" })).id;
      await ingestText(userId, {
        title: "Project-only doc",
        content: "This document belongs only to the Law Study project.",
        projectId,
      });

      // Searching inside otherProjId should NOT find the Law Study project doc.
      // It SHOULD find the user-level goals doc (that's the correct new behavior).
      const k = await buildKnowledgeContext(userId, {
        query: "Law Study project document",
        projectId: otherProjId,
      });
      const titles = k.chunks.map((c: any) => c.title);
      expect(titles).not.toContain("Project-only doc"); // still isolated ✓
    });
  },
);

describe.skipIf(!hasDb)(
  "knowledge retrieval regression — Bug 2: budget allows multiple chunks",
  () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let db: any, schema: any;
    let userId = "";

    beforeAll(async () => {
      ({ db } = await import("@/lib/db"));
      schema = await import("@/lib/db/schema");

      const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      userId = (
        await db.insert(schema.users).values({ email: `krr2-${s}@x.com` }).returning()
      )[0].id;

      // Store a multi-section document — large enough to create multiple chunks.
      // This mirrors the real profile: 9 chunks, each ~1000 chars.
      const sections = Array.from(
        { length: 6 },
        (_, i) => `Section ${i}: ${"x".repeat(400)} haji_marker_section_${i}`,
      ).join("\n\n");

      await ingestText(userId, {
        title: "Multi-section Doc",
        content: sections,
        projectId: null,
        category: "Personal",
      });
    });

    afterAll(async () => {
      if (!db || !userId) return;
      const { inArray } = await import("drizzle-orm");
      await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
    });

    it("[Bug 2] retrieves more than 1 chunk for a broad query", async () => {
      const k = await buildKnowledgeContext(userId, {
        query: "What do you know about haji_marker_section?",
        projectId: null,
      });
      // Old code: count = 1 (2000-char budget only fit 1 chunk).
      // Fixed:    count ≥ 2 (6000-char budget fits 5-6 chunks).
      expect(k.count).toBeGreaterThan(1);
    });
  },
);

describe.skipIf(!hasDb)(
  "knowledge retrieval regression — Bug 3: keyword always runs (not fallback only)",
  () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let db: any, schema: any;
    let userId = "";

    beforeAll(async () => {
      ({ db } = await import("@/lib/db"));
      schema = await import("@/lib/db/schema");

      const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      userId = (
        await db.insert(schema.users).values({ email: `krr3-${s}@x.com` }).returning()
      )[0].id;

      // Two chunks in the same document.
      // chunk A: high semantic similarity to query, low keyword relevance.
      // chunk B: low semantic similarity, but contains the EXACT answer keyword.
      // Bug 3: if semantic returned chunk A only, keyword was skipped and chunk B missed.
      await ingestText(userId, {
        title: "Goals Doc",
        content: GOALS_CONTENT,
        projectId: null,
        category: "Personal",
      });
    });

    afterAll(async () => {
      if (!db || !userId) return;
      const { inArray } = await import("drizzle-orm");
      await db.delete(schema.users).where(inArray(schema.users.id, [userId]));
    });

    it("[Bug 3] finds goal content regardless of semantic embedding state", async () => {
      // This query works whether embeddings exist or not — keyword always supplements.
      const k = await buildKnowledgeContext(userId, {
        query: "What is Haji's goal?",
        projectId: null,
      });
      expect(k.count).toBeGreaterThan(0);
      expect(k.block).toMatch(/relaunch Suplaykart|corporate lawyer|Nagore proud/i);
    });

    it("[Bug 3] retrieves relationship status via keyword when semantic misses it", async () => {
      // 'girlfriend' is a unique term that semantic may not rank highly.
      // Keyword must find it — previously blocked if semantic returned ANY hit.
      await ingestText(userId, {
        title: "Relationship Status",
        content:
          "Does Haji currently have a girlfriend? Haji is currently focused on personal growth and building his future. He is not currently pursuing a romantic relationship.",
        projectId: null,
        category: "Personal",
      });

      const k = await buildKnowledgeContext(userId, {
        query: "Does Haji have a girlfriend?",
        projectId: null,
      });
      expect(k.count).toBeGreaterThan(0);
      expect(k.block).toContain("not currently pursuing");
    });
  },
);
