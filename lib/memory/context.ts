import { getActiveMemories } from "./retrieve";
import { rankMemories } from "./ranking";
import { buildMemoryBlock } from "./context-format";
import {
  semanticSearch,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "./semantic-search";

const DEFAULT_BUDGET_TOKENS = 400;
const SEMANTIC_LIMIT = 10;

export interface MemoryContext {
  block: string;
  memories: Array<{ id: string; type: string; content: string }>;
  count: number;
  fallbackUsed: boolean;
}

/**
 * Build the memory context block for a user.
 *
 * Primary path: SEMANTIC retrieval — embeds the current user message and pulls
 * the most similar ACTIVE memories (threshold 0.70, top 10).
 * Fallback: if semantic retrieval returns 0 memories (or no query is given),
 * fall back to keyword/type+recency retrieval over active memories.
 *
 * Always active-only and user-scoped; never includes pending/deleted memories.
 */
export async function buildMemoryContext(
  userId: string,
  opts: { query?: string; budgetTokens?: number } = {},
): Promise<MemoryContext> {
  const budget = opts.budgetTokens ?? DEFAULT_BUDGET_TOKENS;
  const query = opts.query?.trim();

  let items: Array<{ id: string; type: string; content: string }> = [];
  let fallbackUsed = false;

  // Primary: semantic retrieval on the current message.
  if (query) {
    const hits = await semanticSearch(
      userId,
      query,
      SEMANTIC_LIMIT,
      DEFAULT_SIMILARITY_THRESHOLD,
    );
    items = hits.map((h) => ({ id: h.id, type: h.type, content: h.content }));
  }

  // Fallback: keyword/type+recency retrieval over active memories.
  if (items.length === 0) {
    fallbackUsed = true;
    const active = await getActiveMemories(userId);
    const ranked = rankMemories(active, undefined, Date.now());
    items = ranked.map((m) => ({ id: m.id, type: m.type, content: m.content }));
  }

  const { block, used, count } = buildMemoryBlock(items, budget);

  return {
    block,
    memories: used.map((m) => ({ id: m.id, type: m.type, content: m.content })),
    count,
    fallbackUsed,
  };
}
