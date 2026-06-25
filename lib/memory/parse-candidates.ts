/**
 * Pure extraction diagnostics — no imports / side effects → unit-testable.
 * Turns raw LLM output into { parsed, accepted, rejected } with reasons.
 */

export const ALLOWED_TYPES = [
  "preference",
  "fact",
  "identity",
  "goal",
  "note",
] as const;

export interface Candidate {
  type: string;
  content: string;
  durable: boolean;
}

export type RejectReason = "invalid" | "empty" | "temporary" | "duplicate";

export interface RejectedCandidate extends Candidate {
  reason: RejectReason;
}

export interface Diagnostics {
  rawOutput: string;
  malformed: boolean;
  parsed: Candidate[];
  accepted: Candidate[];
  rejected: RejectedCandidate[];
}

// Time-deixis cues that signal a transient statement, not a durable fact.
const TEMPORAL =
  /\b(right now|currently|today|tonight|this (?:morning|afternoon|evening|week)|at the moment|for now|at present|just now|at this point|going to bed|about to)\b/i;

export function isLikelyTemporary(content: string): boolean {
  return TEMPORAL.test(content);
}

/** Pull the first JSON array out of model text (handles fences + object wrappers). */
export function extractArrayJson(text: string): unknown[] | null {
  if (!text || typeof text !== "string") return null;
  const s = text.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const value = JSON.parse(s.slice(start, end + 1));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function toCandidate(raw: unknown): {
  candidate?: Candidate;
  reason?: "invalid" | "empty";
} {
  if (!raw || typeof raw !== "object") return { reason: "invalid" };
  const rec = raw as Record<string, unknown>;
  if (typeof rec.content !== "string") return { reason: "invalid" };
  const content = rec.content.trim();
  if (!content) return { reason: "empty" };

  const type =
    typeof rec.type === "string" &&
    (ALLOWED_TYPES as readonly string[]).includes(rec.type)
      ? rec.type
      : "note";
  const durable = rec.durable !== false;

  return { candidate: { type, content: content.slice(0, 500), durable } };
}

export function analyzeExtraction(
  rawOutput: string,
  existing: Iterable<string> = [],
): Diagnostics {
  const items = extractArrayJson(rawOutput);
  if (!items) {
    return { rawOutput, malformed: true, parsed: [], accepted: [], rejected: [] };
  }

  const parsed: Candidate[] = [];
  const accepted: Candidate[] = [];
  const rejected: RejectedCandidate[] = [];

  const seen = new Set<string>();
  for (const e of existing) seen.add(e.trim().toLowerCase());

  for (const item of items) {
    const { candidate, reason } = toCandidate(item);
    if (!candidate) {
      const rec = item as Record<string, unknown> | null;
      const content =
        rec && typeof rec.content === "string" ? rec.content : "";
      rejected.push({ type: "note", content, durable: false, reason: reason! });
      continue;
    }

    parsed.push(candidate);

    // Temporary: model marked it non-durable OR phrasing is time-bound.
    if (!candidate.durable || isLikelyTemporary(candidate.content)) {
      rejected.push({ ...candidate, durable: false, reason: "temporary" });
      continue;
    }

    const key = candidate.content.toLowerCase();
    if (seen.has(key)) {
      rejected.push({ ...candidate, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    accepted.push(candidate);
  }

  return { rawOutput, malformed: false, parsed, accepted, rejected };
}
