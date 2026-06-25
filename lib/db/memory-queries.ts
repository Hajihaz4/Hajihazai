import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "./index";
import { userMemory } from "./schema";

type MemoryStatus = "pending" | "active" | "deleted";

/**
 * Phase 5 — Memory data layer.
 * Every function is scoped by userId so a user can only ever touch their own
 * memories (ownership enforced at the query level, not just the route level).
 */

/** Viewer list — everything except soft-deleted (rejected) memories. */
export async function listMemories(userId: string) {
  return db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), ne(userMemory.status, "deleted")))
    .orderBy(desc(userMemory.updatedAt));
}

export async function createMemory(
  userId: string,
  input: { type?: string; content: string; status?: MemoryStatus },
) {
  const [row] = await db
    .insert(userMemory)
    .values({
      userId,
      content: input.content,
      ...(input.type ? { type: input.type } : {}),
      ...(input.status ? { status: input.status } : {}),
    })
    .returning();
  return row;
}

export async function updateMemory(
  userId: string,
  id: string,
  input: { type?: string; content?: string },
) {
  const [row] = await db
    .update(userMemory)
    .set({
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteMemory(userId: string, id: string) {
  const [row] = await db
    .delete(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();
  return row ?? null;
}

/** Approve a pending memory → active. Only acts on the user's own pending rows. */
export async function approveMemory(userId: string, id: string) {
  const [row] = await db
    .update(userMemory)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(userMemory.id, id),
        eq(userMemory.userId, userId),
        eq(userMemory.status, "pending"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Reject a pending memory → soft-deleted. Only acts on the user's own pending rows. */
export async function rejectMemory(userId: string, id: string) {
  const [row] = await db
    .update(userMemory)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(
      and(
        eq(userMemory.id, id),
        eq(userMemory.userId, userId),
        eq(userMemory.status, "pending"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Content keys of all non-deleted memories (used to dedupe extraction). */
export async function existingMemoryContents(userId: string) {
  const rows = await listMemories(userId);
  return new Set(rows.map((m) => m.content.trim().toLowerCase()));
}

/* ---------------------- Phase 5 Step 5: management ----------------------- */

/** Every memory for the user, all statuses (management view + export). */
export async function listAllMemories(userId: string) {
  return db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt));
}

export interface MemoryStats {
  active: number;
  pending: number;
  deleted: number;
  total: number;
}

export async function memoryStats(userId: string): Promise<MemoryStats> {
  const rows = await db
    .select({ status: userMemory.status })
    .from(userMemory)
    .where(eq(userMemory.userId, userId));

  const stats: MemoryStats = {
    active: 0,
    pending: 0,
    deleted: 0,
    total: rows.length,
  };
  for (const r of rows) {
    if (r.status === "active") stats.active++;
    else if (r.status === "pending") stats.pending++;
    else if (r.status === "deleted") stats.deleted++;
  }
  return stats;
}

/** Bulk approve — only the user's own PENDING rows transition to active. */
export async function bulkApprove(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .update(userMemory)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(userMemory.userId, userId),
        inArray(userMemory.id, ids),
        eq(userMemory.status, "pending"),
      ),
    )
    .returning();
}

/** Bulk reject — only the user's own PENDING rows transition to deleted. */
export async function bulkReject(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .update(userMemory)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(
      and(
        eq(userMemory.userId, userId),
        inArray(userMemory.id, ids),
        eq(userMemory.status, "pending"),
      ),
    )
    .returning();
}

/** Bulk hard-delete — only the user's own rows (any status). */
export async function bulkDelete(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .delete(userMemory)
    .where(and(eq(userMemory.userId, userId), inArray(userMemory.id, ids)))
    .returning();
}

/** Delete EVERY memory for the user (right-to-be-forgotten). */
export async function forgetAllMemories(userId: string) {
  return db
    .delete(userMemory)
    .where(eq(userMemory.userId, userId))
    .returning();
}
