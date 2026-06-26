import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { conversations, messages } from "./schema";

/* ----------------------------- Conversations ----------------------------- */

export async function listConversations(userId: string) {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function createConversation(userId: string, title = "New chat") {
  const [row] = await db
    .insert(conversations)
    .values({ userId, title })
    .returning();
  return row;
}

/** Fetch a conversation only if it belongs to the given user (ownership guard). */
export async function getConversation(userId: string, id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
  return row ?? null;
}

export async function deleteConversation(userId: string, id: string) {
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function setConversationTitle(id: string, title: string) {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(eq(conversations.id, id));
}

/* -------------------------------- Messages -------------------------------- */

export async function listMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

/**
 * Newest `limit` messages for a conversation, returned in ASC order.
 * Fetches only the rows needed (ORDER BY createdAt DESC LIMIT n) instead of
 * loading the whole conversation and slicing in JS (Phase 9.0 hot-path fix).
 */
export async function listRecentMessages(conversationId: string, limit = 20) {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function addMessage(input: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  modelId?: string;
}) {
  const [row] = await db.insert(messages).values(input).returning();
  // Bump the conversation so it sorts to the top of the sidebar.
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, input.conversationId));
  return row;
}
