import { and, desc, eq, ne } from "drizzle-orm";
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

export async function getMemory(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)));
  return row ?? null;
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
