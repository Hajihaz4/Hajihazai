import { requireAdmin } from "@/lib/admin/session";
import { adminDeleteKnowledge } from "@/lib/admin/queries";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeDocument, knowledgeContent } from "@/lib/db/schema";
import { updateContent, createContent } from "@/lib/db/knowledge-content-queries";
import { createChunks } from "@/lib/db/knowledge-chunk-queries";
import { chunkDocument } from "@/lib/knowledge/chunk";
import { embedDocumentChunks } from "@/lib/knowledge/embed-chunks";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.id, id));
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  const [contentRow] = await db
    .select({ content: knowledgeContent.content })
    .from(knowledgeContent)
    .where(eq(knowledgeContent.documentId, id));

  return Response.json({ document: { ...doc, content: contentRow?.content ?? "" } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const { title, category, brainId, content } = await req.json();

  const [doc] = await db
    .select()
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.id, id));
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  // Update metadata.
  await db
    .update(knowledgeDocument)
    .set({
      ...(title?.trim() ? { title: title.trim() } : {}),
      category: category || null,
      brainId: brainId || null,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeDocument.id, id));

  // Re-chunk when content is changed.
  if (content?.trim()) {
    const text = content.trim();
    const existingContent = await db
      .select({ id: knowledgeContent.id })
      .from(knowledgeContent)
      .where(eq(knowledgeContent.documentId, id));

    if (existingContent.length > 0) {
      await updateContent(doc.userId, id, text);
    } else {
      await createContent(doc.userId, id, text);
    }

    // createChunks is idempotent: clears old chunks then inserts new ones.
    const chunks = chunkDocument(text);
    await createChunks(doc.userId, id, chunks);

    try {
      await embedDocumentChunks(doc.userId, id);
    } catch (err) {
      console.warn("[knowledge] re-embed failed (keyword retrieval still works):", err);
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ok = await adminDeleteKnowledge(id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
