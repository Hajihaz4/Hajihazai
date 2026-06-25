/**
 * Pure parsing of an LLM extraction response into memory candidates.
 * No imports / side effects → unit-testable in isolation.
 */

export const ALLOWED_TYPES = [
  "preference",
  "fact",
  "identity",
  "goal",
  "note",
] as const;

export interface MemoryCandidate {
  type: string;
  content: string;
}

export function parseCandidates(text: string): MemoryCandidate[] {
  if (!text || typeof text !== "string") return [];

  // Strip code fences the model may wrap the JSON in.
  let s = text.replace(/```(?:json)?/gi, "").trim();

  // Isolate the JSON array.
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  s = s.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: MemoryCandidate[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const content = record.content;
    if (typeof content !== "string" || !content.trim()) continue;

    let type = typeof record.type === "string" ? record.type : "note";
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
      type = "note";
    }

    out.push({ type, content: content.trim().slice(0, 500) });
  }
  return out;
}
