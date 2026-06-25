import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { userMemory } from "./schema";

/**
 * Phase 5 — Memory data layer.
 * Every function is scoped by userId so a user can only ever touch their own
 * memories (ownership enforced at the query level, not just the route level).
 */

export async function listMemories(userId: string) {
  return db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
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
  input: { type?: string; content: string },
) {
  const [row] = await db
    .insert(userMemory)
    .values({
      userId,
      content: input.content,
      ...(input.type ? { type: input.type } : {}),
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
