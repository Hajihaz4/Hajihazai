/**
 * Pure ranking + keyword-search logic for memory retrieval.
 * No imports / side effects → unit-testable in isolation.
 * (No embeddings, no vector search — keyword + type/recency ranking only.)
 */

// Type importance: preference > identity > business(fact) > goal > note.
export const TYPE_WEIGHTS: Record<string, number> = {
  preference: 4,
  identity: 3,
  fact: 2, // "business" facts map to type 'fact'
  goal: 2,
  note: 1,
};

export function typeWeight(type: string): number {
  return TYPE_WEIGHTS[type] ?? 1;
}

interface Rankable {
  type: string;
  content: string;
  updatedAt: Date | string | number;
}

/**
 * Ranking score = type importance + a small recency bonus in (0,1].
 * Type dominates; recency breaks ties and nudges newer items up.
 */
export function scoreMemory(m: Rankable, now: number): number {
  const updated = new Date(m.updatedAt).getTime();
  const ageDays = Math.max(0, (now - updated) / 86_400_000);
  const recency = 1 / (1 + ageDays);
  return Number((typeWeight(m.type) + recency).toFixed(4));
}

/** Case-insensitive keyword match: full-query substring OR all tokens present. */
export function matchesQuery(content: string, q?: string): boolean {
  if (!q || !q.trim()) return true;
  const c = content.toLowerCase();
  const query = q.trim().toLowerCase();
  if (c.includes(query)) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((tok) => c.includes(tok));
}

export function rankMemories<T extends Rankable>(
  items: T[],
  q: string | undefined,
  now: number,
): Array<T & { score: number }> {
  return items
    .filter((m) => matchesQuery(m.content, q))
    .map((m) => ({ ...m, score: scoreMemory(m, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}
