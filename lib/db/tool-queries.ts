import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { toolInvocation } from "./schema";

type Status = "success" | "error" | "timeout";

/**
 * Record a tool invocation. BEST-EFFORT: audit must never break the user flow,
 * so all errors (FK violations, missing DB) are swallowed and logged.
 */
export async function recordToolInvocation(row: {
  userId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  status: Status;
  durationMs: number;
  error?: string | null;
}): Promise<void> {
  try {
    await db.insert(toolInvocation).values({
      userId: row.userId,
      toolName: row.toolName,
      input: row.input ?? null,
      output: row.output ?? null,
      status: row.status,
      durationMs: row.durationMs,
      error: row.error ?? null,
    });
  } catch (err) {
    console.error("recordToolInvocation failed (non-fatal):", err);
  }
}

/** List a user's tool invocations, most recent first (observability page). */
export async function listToolInvocations(userId: string, limit = 100) {
  return db
    .select({
      id: toolInvocation.id,
      toolName: toolInvocation.toolName,
      status: toolInvocation.status,
      durationMs: toolInvocation.durationMs,
      error: toolInvocation.error,
      createdAt: toolInvocation.createdAt,
    })
    .from(toolInvocation)
    .where(eq(toolInvocation.userId, userId))
    .orderBy(desc(toolInvocation.createdAt))
    .limit(limit);
}
