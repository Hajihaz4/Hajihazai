import { eq, isNull, or, type SQL } from "drizzle-orm";
import { knowledgeDocument } from "@/lib/db/schema";

/**
 * Knowledge retrieval scope:
 *   undefined → no project filter (all the user's documents)
 *   null      → user-level documents only (project_id IS NULL)
 *   string    → that project's documents PLUS user-level documents
 *
 * User-level documents (projectId = null) are global knowledge — they are
 * always visible to the owner regardless of which project chat is active.
 * Only project-to-project isolation is enforced (project A never sees project B).
 */
export function projectScope(
  projectId: string | null | undefined,
): SQL | undefined {
  if (projectId === undefined) return undefined;
  if (projectId === null) return isNull(knowledgeDocument.projectId);
  // Project chat: include this project's docs AND user-level (global) docs.
  return or(
    eq(knowledgeDocument.projectId, projectId),
    isNull(knowledgeDocument.projectId),
  ) as SQL;
}
