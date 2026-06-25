import { describe, it, expect, beforeAll, afterAll } from "vitest";

// DB-backed knowledge-document registry tests. Skipped without DATABASE_URL.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("knowledge document registry (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let q: any;
  let A = "";
  let B = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    q = await import("@/lib/db/knowledge-queries");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (email: string) =>
      (await db.insert(schema.users).values({ email }).returning())[0].id;
    A = await mk(`kb-A-${s}@example.com`);
    B = await mk(`kb-B-${s}@example.com`);
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("creates a document with defaults", async () => {
    const doc = await q.createDocument(A, { title: "Founder Handbook" });
    expect(doc.id).toBeTruthy();
    expect(doc.title).toBe("Founder Handbook");
    expect(doc.sourceType).toBe("note");
    expect(doc.status).toBe("active");
  });

  it("lists only the owner's documents (isolation)", async () => {
    await q.createDocument(A, { title: "A doc", sourceType: "text" });
    await q.createDocument(B, { title: "B doc", sourceType: "pdf" });

    const aList = await q.listDocuments(A);
    expect(aList.every((d: any) => d.userId === A)).toBe(true);
    expect(aList.some((d: any) => d.title === "B doc")).toBe(false);
  });

  it("blocks get/delete/update by a non-owner (ownership)", async () => {
    const doc = await q.createDocument(A, { title: "A private", sourceType: "website" });
    expect(await q.getDocument(B, doc.id)).toBeNull();
    expect(await q.updateDocumentStatus(B, doc.id, "failed")).toBeNull();
    expect(await q.deleteDocument(B, doc.id)).toBeNull();

    // still intact and owned by A
    const still = await q.getDocument(A, doc.id);
    expect(still?.id).toBe(doc.id);
    expect(still?.status).toBe("active");
  });

  it("updates status for the owner", async () => {
    const doc = await q.createDocument(A, { title: "Processing doc", status: "processing" });
    expect(doc.status).toBe("processing");
    const updated = await q.updateDocumentStatus(A, doc.id, "active");
    expect(updated?.status).toBe("active");
  });

  it("deletes the owner's document", async () => {
    const doc = await q.createDocument(A, { title: "To delete" });
    const deleted = await q.deleteDocument(A, doc.id);
    expect(deleted?.id).toBe(doc.id);
    expect(await q.getDocument(A, doc.id)).toBeNull();
  });
});
