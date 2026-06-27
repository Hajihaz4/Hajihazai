import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { knowledgeChunk, knowledgeDocument } from "@/lib/db/schema";
import { projectScope } from "./scope";
import type { DocumentSearchHit } from "./semantic-search";

/**
 * Keyword retrieval over knowledge chunks — the reliable fallback that works
 * even when chunks are NOT embedded or the embedding provider is down.
 *
 * Ranks chunks by how many distinct query terms appear in them (ILIKE). Active,
 * owned, project-scoped. This is what guarantees stored knowledge is actually
 * used (semantic search silently returns nothing for un-embedded chunks).
 */

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "of", "at", "in",
  "on", "to", "for", "and", "or", "as", "by", "with", "which", "what", "who",
  "whom", "whose", "does", "do", "did", "where", "when", "how", "why", "i",
  "you", "he", "she", "it", "we", "they", "my", "his", "her", "their", "this",
  "that", "these", "those", "from", "about",
]);

export function tokenize(query: string): string[] {
  const seen = new Set<string>();
  for (const raw of query.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    seen.add(raw);
  }
  return [...seen];
}

export async function keywordDocumentSearch(
  userId: string,
  query: string,
  opts: { projectId?: string | null; limit?: number } = {},
): Promise<DocumentSearchHit[]> {
  const terms = tokenize(query);
  if (terms.length === 0) return [];
  const limit = opts.limit ?? 10;

  const score = sql<number>`(${sql.join(
    terms.map(
      (t) =>
        sql`(case when ${knowledgeChunk.content} ilike ${"%" + t + "%"} then 1 else 0 end)`,
    ),
    sql` + `,
  )})`;
  const anyMatch = sql`(${sql.join(
    terms.map((t) => sql`${knowledgeChunk.content} ilike ${"%" + t + "%"}`),
    sql` or `,
  )})`;

  const rows = await db
    .select({
      documentId: knowledgeDocument.id,
      title: knowledgeDocument.title,
      chunkId: knowledgeChunk.id,
      content: knowledgeChunk.content,
      score,
    })
    .from(knowledgeChunk)
    .innerJoin(
      knowledgeDocument,
      eq(knowledgeChunk.documentId, knowledgeDocument.id),
    )
    .where(
      and(
        eq(knowledgeDocument.userId, userId),
        eq(knowledgeDocument.status, "active"),
        projectScope(opts.projectId),
        anyMatch,
      ),
    )
    .orderBy(desc(score))
    .limit(limit);

  return rows.map((r) => ({
    documentId: r.documentId,
    title: r.title,
    chunkId: r.chunkId,
    content: r.content,
    similarity: Number(r.score),
  }));
}
