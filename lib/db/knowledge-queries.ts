import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { knowledgeDocument } from "./schema";

type SourceType = "pdf" | "text" | "website" | "note";
type DocStatus = "processing" | "active" | "failed";

/**
 * Phase 7.0 — Knowledge Base document registry (foundation only).
 * Every function is scoped by userId so a user can only ever touch their own
 * documents (ownership enforced at the query level).
 * No embeddings / chunking / retrieval here — registry metadata only.
 */

export async function listDocuments(userId: string) {
  return db
    .select()
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.userId, userId))
    .orderBy(desc(knowledgeDocument.updatedAt));
}

export async function getDocument(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(knowledgeDocument)
    .where(
      and(eq(knowledgeDocument.id, id), eq(knowledgeDocument.userId, userId)),
    );
  return row ?? null;
}

export async function createDocument(
  userId: string,
  input: {
    title: string;
    sourceType?: SourceType;
    status?: DocStatus;
    projectId?: string | null;
  },
) {
  const [row] = await db
    .insert(knowledgeDocument)
    .values({
      userId,
      title: input.title,
      projectId: input.projectId ?? null,
      ...(input.sourceType ? { sourceType: input.sourceType } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    .returning();
  return row;
}

/** Documents for a specific project (ownership-scoped). */
export async function listProjectDocuments(userId: string, projectId: string) {
  return db
    .select()
    .from(knowledgeDocument)
    .where(
      and(
        eq(knowledgeDocument.userId, userId),
        eq(knowledgeDocument.projectId, projectId),
      ),
    )
    .orderBy(desc(knowledgeDocument.updatedAt));
}

export async function updateDocumentStatus(
  userId: string,
  id: string,
  status: DocStatus,
) {
  const [row] = await db
    .update(knowledgeDocument)
    .set({ status, updatedAt: new Date() })
    .where(
      and(eq(knowledgeDocument.id, id), eq(knowledgeDocument.userId, userId)),
    )
    .returning();
  return row ?? null;
}

export async function deleteDocument(userId: string, id: string) {
  const [row] = await db
    .delete(knowledgeDocument)
    .where(
      and(eq(knowledgeDocument.id, id), eq(knowledgeDocument.userId, userId)),
    )
    .returning();
  return row ?? null;
}
