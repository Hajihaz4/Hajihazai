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

/**
 * Stopwords + "haji"/"hajis" (present in nearly every memory, so useless as a
 * discriminator). Excluded from keyword matching so a natural-language question
 * matches on its CONTENT words, not filler.
 */
const MEMORY_STOPWORDS = new Set([
  "what", "whats", "who", "whos", "whose", "when", "where", "why", "how", "which",
  "is", "are", "was", "were", "be", "am", "do", "does", "did", "has", "have", "had",
  "the", "a", "an", "of", "to", "in", "on", "at", "for", "and", "or", "with", "about",
  "his", "her", "hers", "their", "them", "he", "she", "they", "it", "its", "that", "this",
  "tell", "me", "give", "list", "show", "haji", "hajis", "you", "your", "please",
]);

/** Content words (≥3 chars, non-stopword) from a query. */
export function significantTokens(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !MEMORY_STOPWORDS.has(t));
}

/**
 * Case-insensitive keyword match. Matches when the full query is a substring, or
 * when the content shares ANY significant token with the query (with a light
 * trailing-'s' plural fold so "goals" matches "goal"). A query made only of
 * stopwords matches nothing (so low-information turns never dump every memory).
 * Result volume is bounded downstream by the memory char budget + type ranking.
 */
export function matchesQuery(content: string, q?: string): boolean {
  if (!q || !q.trim()) return true;
  const c = content.toLowerCase();
  if (c.includes(q.trim().toLowerCase())) return true;
  const toks = significantTokens(q);
  if (toks.length === 0) return false;
  return toks.some(
    (tok) => c.includes(tok) || (tok.length > 3 && tok.endsWith("s") && c.includes(tok.slice(0, -1))),
  );
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
