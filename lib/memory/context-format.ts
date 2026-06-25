/**
 * Pure formatting for the memory context block — no imports / side effects.
 * Token budget is enforced here so it is unit-testable in isolation.
 */

const MEMORY_HEADER = "Known facts about the user:";

/** Rough token estimate (~4 chars/token) — good enough for budgeting. */
export function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export function formatMemoryLine(content: string): string {
  const c = content.trim();
  if (!c) return "";
  return /[.!?]$/.test(c) ? c : `${c}.`;
}

export interface BlockItem {
  content: string;
}

/**
 * Build the context block from ranked memories, stopping before the token
 * budget is exceeded. Returns the block, the memories actually used, and count.
 */
export function buildMemoryBlock<T extends BlockItem>(
  memories: T[],
  budgetTokens = 400,
): { block: string; used: T[]; count: number } {
  const used: T[] = [];
  const lines: string[] = [];
  let tokens = approxTokens(MEMORY_HEADER);

  for (const m of memories) {
    const formatted = formatMemoryLine(m.content);
    if (!formatted) continue;
    const line = `- ${formatted}`;
    const lineTokens = approxTokens(line) + 1; // +1 for the newline
    if (tokens + lineTokens > budgetTokens) break;
    tokens += lineTokens;
    lines.push(line);
    used.push(m);
  }

  if (lines.length === 0) return { block: "", used: [], count: 0 };
  return { block: [MEMORY_HEADER, ...lines].join("\n"), used, count: used.length };
}
