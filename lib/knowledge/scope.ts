import { eq, isNull, type SQL } from "drizzle-orm";
import { knowledgeDocument } from "@/lib/db/schema";

/**
 * Knowledge retrieval scope:
 *   undefined → no project filter (all the user's documents)
 *   null      → user-level documents only (project_id IS NULL)
 *   string    → that project's documents only
 *
 * Used by every retrieval path so a project chat can only ever see its own
 * project's knowledge, and a loose chat only sees user-level knowledge.
 */
export function projectScope(
  projectId: string | null | undefined,
): SQL | undefined {
  if (projectId === undefined) return undefined;
  if (projectId === null) return isNull(knowledgeDocument.projectId);
  return eq(knowledgeDocument.projectId, projectId);
}
