import { eq, isNull, or, type SQL } from "drizzle-orm";
import { knowledgeDocument } from "@/lib/db/schema";

/**
 * Feature flag (Phase F): shared-brain retrieval is OFF until documents are moved
 * into the shared brain and the path is verified. Prepared, not activated.
 */
export const SHARED_BRAIN_ENABLED = process.env.SHARED_BRAIN_ENABLED === "true";

/**
 * Brain retrieval scope:
 *   undefined → no brain filter (all docs visible regardless of brain)
 *   null      → only docs with no brain assigned (brain_id IS NULL)
 *   string    → docs in that brain PLUS docs with no brain assigned
 *
 * Shared-brain path (inert unless SHARED_BRAIN_ENABLED and a sharedBrainId is
 * supplied): a selected brain additionally reads the shared brain instead of the
 * NULL-brain global pool. This is prepared for a future rollout; it changes
 * nothing while the flag is off, which is the default.
 */
export function brainScope(
  brainId: string | null | undefined,
  sharedBrainId?: string | null,
): SQL | undefined {
  if (brainId === undefined) return undefined;
  if (brainId === null) return isNull(knowledgeDocument.brainId);
  if (SHARED_BRAIN_ENABLED && sharedBrainId) {
    return or(
      eq(knowledgeDocument.brainId, brainId),
      eq(knowledgeDocument.brainId, sharedBrainId),
    ) as SQL;
  }
  return or(
    eq(knowledgeDocument.brainId, brainId),
    isNull(knowledgeDocument.brainId),
  ) as SQL;
}

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
