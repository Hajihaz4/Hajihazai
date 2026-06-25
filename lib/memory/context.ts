import { getActiveMemories } from "./retrieve";
import { rankMemories } from "./ranking";
import { buildMemoryBlock } from "./context-format";
import {
  semanticSearch,
  DEFAULT_SIMILARITY_THRESHOLD,
} from "./semantic-search";
import {
  semanticDocumentSearch,
  DEFAULT_DOC_SIMILARITY_THRESHOLD,
  type DocumentSearchHit,
} from "@/lib/knowledge/semantic-search";

const DEFAULT_BUDGET_TOKENS = 400;
const SEMANTIC_LIMIT = 10;
const KNOWLEDGE_LIMIT = 10;
const KNOWLEDGE_MAX_CHARS = 2000;

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

/* ------------------------------------------------------------------ */
/* Phase 7.5 — Knowledge context (RAG foundation)                      */
/* ------------------------------------------------------------------ */

export interface KnowledgeContext {
  block: string;
  chunks: DocumentSearchHit[];
  count: number;
}

/** Render the knowledge block grouped by document, capped at maxChars. */
function renderKnowledgeBlock(selected: DocumentSearchHit[]): string {
  const order: string[] = [];
  const groups = new Map<string, { title: string; chunks: string[] }>();
  for (const h of selected) {
    if (!groups.has(h.documentId)) {
      groups.set(h.documentId, { title: h.title, chunks: [] });
      order.push(h.documentId);
    }
    groups.get(h.documentId)!.chunks.push(h.content);
  }
  const parts = ["Knowledge Base:"];
  for (const docId of order) {
    const g = groups.get(docId)!;
    parts.push(`[Document: ${g.title}]\n\`\`\`\n${g.chunks.join("\n\n")}\n\`\`\``);
  }
  return parts.join("\n\n");
}

/** Pure block builder — greedily include chunks while staying within budget. */
export function buildKnowledgeBlock(
  hits: DocumentSearchHit[],
  maxChars: number = KNOWLEDGE_MAX_CHARS,
): { block: string; used: DocumentSearchHit[]; count: number } {
  const used: DocumentSearchHit[] = [];
  for (const h of hits) {
    if (renderKnowledgeBlock([...used, h]).length > maxChars) break;
    used.push(h);
  }
  if (used.length === 0) return { block: "", used: [], count: 0 };
  return { block: renderKnowledgeBlock(used), used, count: used.length };
}

/**
 * Build the knowledge context block from the user's documents via semantic
 * search on the current message. Active + owned documents only (enforced by
 * semanticDocumentSearch). Token budget: max 2000 characters.
 */
export async function buildKnowledgeContext(
  userId: string,
  opts: { query?: string; maxChars?: number } = {},
): Promise<KnowledgeContext> {
  const query = opts.query?.trim();
  if (!query) return { block: "", chunks: [], count: 0 };

  const hits = await semanticDocumentSearch(
    userId,
    query,
    KNOWLEDGE_LIMIT,
    DEFAULT_DOC_SIMILARITY_THRESHOLD,
  );
  const { block, used, count } = buildKnowledgeBlock(
    hits,
    opts.maxChars ?? KNOWLEDGE_MAX_CHARS,
  );

  return { block, chunks: used, count };
}
