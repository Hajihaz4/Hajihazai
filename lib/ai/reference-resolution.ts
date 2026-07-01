/**
 * Conversation reference resolution (Phase 3) — topic continuity.
 *
 * When a follow-up message uses a pronoun ("where does HE study?") or a bare
 * reference ("that company") without naming an entity, resolve it to the most
 * recent entity mentioned in the conversation, so routing and retrieval use the
 * intended subject. Safe by design: only resolves when there is exactly one
 * unambiguous recent entity; otherwise it leaves the message untouched.
 */

/** Known entities (people, businesses, places) used for reference resolution. */
export const KNOWN_ENTITIES = [
  "haji", "alim", "safina", "shehnaz", "sahabuddin", "hamza", "hidhayaa",
  "kabeer", "azees", "kaif", "abul", "selva", "sundar", "hussain", "meeran",
  "allbee", "suplaykart", "nagore",
] as const;

const PRONOUN_RE =
  /\b(he|him|his|she|her|hers|they|them|their|theirs|it|its|that\s+(company|business|brain|firm|one|guy|person)|the\s+(company|business|firm))\b/i;

/** Cheap pre-check: does this message need reference resolution at all? */
export function needsResolution(message: string): boolean {
  return extractEntities(message).length === 0 && PRONOUN_RE.test(message);
}

/** Entities explicitly named in a piece of text. */
export function extractEntities(text: string): string[] {
  const lower = text.toLowerCase();
  return KNOWN_ENTITIES.filter((e) => new RegExp(`\\b${e}\\b`).test(lower));
}

export interface ResolvedReference {
  /** Query to use for routing + retrieval (original, or enriched with the entity). */
  resolved: string;
  /** The entity a pronoun/reference was resolved to, or null if none. */
  entity: string | null;
  /** Why resolution did/didn't happen — surfaced in admin debug. */
  reason: string;
}

/**
 * Resolve a pronoun/reference in `current` using prior USER messages
 * (chronological order — oldest first). Only the routing/retrieval query is
 * enriched; the message shown to the user is never changed by the caller.
 */
export function resolveReference(current: string, priorUserMessages: string[]): ResolvedReference {
  // Already names an entity → nothing to resolve.
  if (extractEntities(current).length > 0) {
    return { resolved: current, entity: null, reason: "message already names an entity" };
  }
  // No pronoun/reference → nothing to resolve.
  if (!PRONOUN_RE.test(current)) {
    return { resolved: current, entity: null, reason: "no pronoun/reference to resolve" };
  }
  // Walk prior user messages from most-recent backwards; use the first message
  // that names EXACTLY ONE entity (unambiguous). Stop on ambiguity.
  for (let i = priorUserMessages.length - 1; i >= 0; i--) {
    const ents = extractEntities(priorUserMessages[i]);
    if (ents.length === 1) {
      return {
        resolved: `${current.trim()} (referring to ${ents[0]})`,
        entity: ents[0],
        reason: `resolved reference → "${ents[0]}" from a prior turn`,
      };
    }
    if (ents.length > 1) {
      return { resolved: current, entity: null, reason: `ambiguous — prior turn named multiple entities (${ents.join(", ")})` };
    }
  }
  return { resolved: current, entity: null, reason: "no entity found in recent turns" };
}
