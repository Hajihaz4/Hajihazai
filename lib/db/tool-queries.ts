import { desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { toolInvocation } from "./schema";

type Status = "success" | "error" | "timeout";

/**
 * Audit payload cap (Phase 8.4). Serialized input/output larger than this are
 * NOT stored verbatim — a truncation marker is stored instead, while the real
 * byte size is always recorded in inputSize/outputSize.
 */
export const AUDIT_MAX_PAYLOAD_CHARS = 2000;

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return '"[unserializable]"';
  }
}

/** Returns the value to store (capped) plus its true serialized size. */
function capPayload(value: unknown): { stored: unknown; size: number } {
  const str = serialize(value);
  if (str.length > AUDIT_MAX_PAYLOAD_CHARS) {
    return {
      stored: { _truncated: true, size: str.length, preview: str.slice(0, 200) },
      size: str.length,
    };
  }
  return { stored: value ?? null, size: str.length };
}

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
    const input = capPayload(row.input);
    const output = capPayload(row.output);
    await db.insert(toolInvocation).values({
      userId: row.userId,
      toolName: row.toolName,
      input: input.stored,
      output: output.stored,
      status: row.status,
      durationMs: row.durationMs,
      inputSize: input.size,
      outputSize: output.size,
      error: row.error ?? null,
    });
  } catch (err) {
    console.error("recordToolInvocation failed (non-fatal):", err);
  }
}

/** Paginated list of a user's tool invocations, most recent first. */
export async function listToolInvocations(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  return db
    .select({
      id: toolInvocation.id,
      toolName: toolInvocation.toolName,
      status: toolInvocation.status,
      durationMs: toolInvocation.durationMs,
      inputSize: toolInvocation.inputSize,
      outputSize: toolInvocation.outputSize,
      error: toolInvocation.error,
      createdAt: toolInvocation.createdAt,
    })
    .from(toolInvocation)
    .where(eq(toolInvocation.userId, userId))
    .orderBy(desc(toolInvocation.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countToolInvocations(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(toolInvocation)
    .where(eq(toolInvocation.userId, userId));
  return row?.n ?? 0;
}
