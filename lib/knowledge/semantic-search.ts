import { and, cosineDistance, desc, eq, gt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeChunk, knowledgeDocument } from "@/lib/db/schema";
import { embed } from "@/lib/ai/embeddings/router";
import { projectScope } from "./scope";

/**
 * Standalone semantic search over knowledge-base chunk embeddings.
 * - Embeds the query with the Phase 6 embedding router.
 * - Ranks chunks by cosine similarity (pgvector), joined to the parent doc.
 * - ACTIVE documents only, owned by the user, above the threshold, sorted desc.
 *
 * Standalone: does NOT inject into prompts, does NOT touch chat, no RAG.
 */
export const DEFAULT_DOC_SIMILARITY_THRESHOLD = 0.7;

export interface DocumentSearchHit {
  documentId: string;
  title: string;
  chunkId: string;
  content: string;
  similarity: number;
}

export async function semanticDocumentSearch(
  userId: string,
  query: string,
  limit = 10,
  threshold = DEFAULT_DOC_SIMILARITY_THRESHOLD,
  opts: { projectId?: string | null } = {},
): Promise<DocumentSearchHit[]> {
  if (!query || !query.trim()) return [];

  const { embedding: queryVector } = await embed(query);

  // cosine similarity = 1 - cosine distance
  const similarity = sql<number>`1 - (${cosineDistance(knowledgeChunk.embedding, queryVector)})`;

  const rows = await db
    .select({
      documentId: knowledgeDocument.id,
      title: knowledgeDocument.title,
      chunkId: knowledgeChunk.id,
      content: knowledgeChunk.content,
      similarity,
    })
    .from(knowledgeChunk)
    .innerJoin(
      knowledgeDocument,
      eq(knowledgeChunk.documentId, knowledgeDocument.id),
    )
    .where(
      and(
        eq(knowledgeDocument.userId, userId), // ownership
        eq(knowledgeDocument.status, "active"), // active documents only
        projectScope(opts.projectId), // project isolation
        isNotNull(knowledgeChunk.embedding),
        gt(similarity, threshold), // similarity threshold
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
}
