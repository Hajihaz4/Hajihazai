import { getActiveMemories } from "./retrieve";
import { rankMemories } from "./ranking";
import { buildMemoryBlock } from "./context-format";

const DEFAULT_BUDGET_TOKENS = 400;

export interface MemoryContext {
  block: string;
  memories: Array<{ id: string; type: string; content: string }>;
  count: number;
  totalActive: number;
}

/**
 * Build the memory context block for a user:
 *  - retrieves ACTIVE memories only (pending + deleted never included),
 *  - ranks them by type importance + recency,
 *  - assembles a token-budgeted block.
 * User-scoped via getActiveMemories(userId).
 */
export async function buildMemoryContext(
  userId: string,
  opts: { budgetTokens?: number } = {},
): Promise<MemoryContext> {
  const active = await getActiveMemories(userId);
  const ranked = rankMemories(active, undefined, Date.now());
  const { block, used, count } = buildMemoryBlock(
    ranked,
    opts.budgetTokens ?? DEFAULT_BUDGET_TOKENS,
  );

  return {
    block,
    memories: used.map((m) => ({ id: m.id, type: m.type, content: m.content })),
    count,
    totalActive: active.length,
  };
}
