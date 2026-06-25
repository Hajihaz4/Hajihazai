import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;
const QUERY = "does the user run a coffee business";

describe.skipIf(!hasDb)("knowledge semantic document search (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let docs: any;
  let chunkQ: any;
  let embedSvc: any;
  let search: any;
  let A = "";
  let B = "";
  let ready = false;
  const ids: Record<string, string> = {};

  async function makeDoc(
    userId: string,
    title: string,
    text: string,
    status: "active" | "processing" | "failed" = "active",
    embed = true,
  ) {
    const doc = await docs.createDocument(userId, { title, status });
    await chunkQ.createChunks(userId, doc.id, [{ chunkIndex: 0, content: text }]);
    if (embed) await embedSvc.embedDocumentChunks(userId, doc.id);
    return doc.id as string;
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    docs = await import("@/lib/db/knowledge-queries");
    chunkQ = await import("@/lib/db/knowledge-chunk-queries");
    embedSvc = await import("@/lib/knowledge/embed-chunks");
    search = await import("@/lib/knowledge/semantic-search");

    try {
      const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api";
      const res = await fetch(`${base}/tags`);
      const data = await res.json();
      ready =
        res.ok &&
        Array.isArray(data?.models) &&
        data.models.some((m: { name: string }) =>
          m.name.includes("nomic-embed-text"),
        );
    } catch {
      ready = false;
    }
    if (!ready) return;

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (email: string) =>
      (await db.insert(schema.users).values({ email }).returning())[0].id;
    A = await mk(`ks-A-${s}@example.com`);
    B = await mk(`ks-B-${s}@example.com`);

    ids.related = await makeDoc(
      A,
      "Coffee Business",
      "The user runs a coffee business called BeanWorks with shops in Dubai.",
    );
    ids.unrelated = await makeDoc(
      A,
      "Allergies",
      "The user is allergic to peanuts and avoids nuts entirely.",
    );
    // B has a coffee doc → isolation check
    ids.bRelated = await makeDoc(
      B,
      "B Coffee",
      "The user runs a coffee business called BeanWorks with shops in Dubai.",
    );
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("returns related chunks, excludes unrelated, sorted descending", async () => {
    if (!ready) return;
    const hits = await search.semanticDocumentSearch(A, QUERY);
    const docIds = hits.map((h: any) => h.documentId);

    expect(docIds).toContain(ids.related);
    expect(docIds).not.toContain(ids.unrelated);

    // sorted descending by similarity
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].similarity).toBeGreaterThanOrEqual(hits[i].similarity);
    }
    // each hit carries title + chunk content
    expect(hits[0].title).toBeTruthy();
    expect(hits[0].content).toContain("coffee");
  });

  it("respects the similarity threshold", async () => {
    if (!ready) return;
    // An impossibly high threshold returns nothing.
    const none = await search.semanticDocumentSearch(A, QUERY, 10, 0.999);
    expect(none.length).toBe(0);
    // A permissive threshold returns at least the related doc.
    const some = await search.semanticDocumentSearch(A, QUERY, 10, 0.3);
    expect(some.some((h: any) => h.documentId === ids.related)).toBe(true);
  });

  it("maintains user isolation (A never sees B's chunks)", async () => {
    if (!ready) return;
    const hits = await search.semanticDocumentSearch(A, QUERY, 10, 0.1);
    const docIds = hits.map((h: any) => h.documentId);
    expect(docIds).not.toContain(ids.bRelated);
    expect(docIds.every((id: string) => [ids.related, ids.unrelated].includes(id))).toBe(
      true,
    );
  });

  it("excludes non-active documents (ownership/status)", async () => {
    if (!ready) return;
    const procId = await makeDoc(
      A,
      "Processing Coffee",
      "The user runs a coffee business called BeanWorks.",
      "processing",
    );
    const hits = await search.semanticDocumentSearch(A, QUERY, 10, 0.1);
    expect(hits.map((h: any) => h.documentId)).not.toContain(procId);
  });

  it("returns empty for a blank query", async () => {
    if (!ready) return;
    expect(await search.semanticDocumentSearch(A, "  ")).toEqual([]);
  });
});
