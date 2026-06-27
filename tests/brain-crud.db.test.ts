/**
 * Brain CRUD — database integration tests.
 * Verifies the brains table, seed data, and query functions.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  listBrains,
  getBrainById,
  getBrainBySlug,
  createBrain,
  updateBrain,
  deleteBrain,
  getBrainStats,
} from "@/lib/db/brain-queries";
import { db } from "@/lib/db";
import { brains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("brain CRUD (db)", () => {
  const testSlug = `test-brain-${Date.now()}`;
  let testId = "";

  afterAll(async () => {
    if (testId) await db.delete(brains).where(eq(brains.id, testId));
  });

  it("seeds 4 system brains on migration", async () => {
    const all = await listBrains();
    const slugs = all.map((b) => b.slug);
    expect(slugs).toContain("haji-core");
    expect(slugs).toContain("suplaykart");
    expect(slugs).toContain("allbee");
    expect(slugs).toContain("legal");
  });

  it("getBrainBySlug returns system brains", async () => {
    const core = await getBrainBySlug("haji-core");
    expect(core).not.toBeNull();
    expect(core?.isSystem).toBe(true);
    expect(core?.name).toBe("Haji Core");
  });

  it("createBrain inserts a new brain", async () => {
    const brain = await createBrain({
      name: "Test Brain",
      slug: testSlug,
      description: "A test brain",
      icon: "🧪",
      color: "#ff0000",
      isSystem: false,
    });
    testId = brain.id;
    expect(brain.slug).toBe(testSlug);
    expect(brain.isSystem).toBe(false);
  });

  it("getBrainById retrieves the created brain", async () => {
    const brain = await getBrainById(testId);
    expect(brain?.name).toBe("Test Brain");
    expect(brain?.icon).toBe("🧪");
  });

  it("updateBrain changes name and icon", async () => {
    const updated = await updateBrain(testId, { name: "Updated Brain", icon: "✅" });
    expect(updated?.name).toBe("Updated Brain");
    expect(updated?.icon).toBe("✅");
  });

  it("getBrainStats returns counts per brain", async () => {
    const stats = await getBrainStats();
    expect(Array.isArray(stats)).toBe(true);
    const hajiCore = stats.find((b) => b.slug === "haji-core");
    expect(hajiCore).toBeDefined();
    expect(typeof hajiCore?.documentCount).toBe("number");
    expect(typeof hajiCore?.chunkCount).toBe("number");
  });

  it("deleteBrain removes it", async () => {
    const ok = await deleteBrain(testId);
    expect(ok).toBe(true);
    const notFound = await getBrainById(testId);
    expect(notFound).toBeNull();
    testId = "";
  });

  it("getBrainById returns null for nonexistent id", async () => {
    const notFound = await getBrainById("00000000-0000-0000-0000-000000000000");
    expect(notFound).toBeNull();
  });
});
