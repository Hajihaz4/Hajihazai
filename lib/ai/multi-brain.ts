/**
 * Multi-brain scope detection (Phase 4).
 *
 * Some questions span more than one brain — "compare AllBee and Suplaykart",
 * "what businesses does Haji own", "what connects Haji and Alim". For these we
 * retrieve from several brains and merge the context. Legal is NEVER auto-added
 * (isolation) — it only participates when the query is explicitly legal, which
 * the normal single-brain router already handles.
 *
 * Returns [] when the query is single-brain (use normal routing). Returns 2+
 * brain slugs when it genuinely spans brains.
 */
import { extractEntities } from "./reference-resolution";

const ENTITY_TO_BRAIN: Record<string, string> = {
  haji: "haji-core", safina: "haji-core", shehnaz: "haji-core", sahabuddin: "haji-core",
  hamza: "haji-core", hidhayaa: "haji-core", kabeer: "haji-core", azees: "haji-core",
  kaif: "haji-core", abul: "haji-core", selva: "haji-core", sundar: "haji-core",
  hussain: "haji-core", meeran: "haji-core", nagore: "haji-core",
  alim: "allbee", allbee: "allbee",
  suplaykart: "suplaykart",
};

export function detectMultiBrainScope(message: string): string[] {
  const lower = message.toLowerCase();
  const brains = new Set<string>();
  for (const e of extractEntities(message)) {
    const b = ENTITY_TO_BRAIN[e];
    if (b) brains.add(b);
  }
  // "what businesses / companies does Haji own", "Haji's ventures" → both businesses.
  if (
    /\b(business(es)?|compan(y|ies)|ventures?|startups?|own|owns)\b/.test(lower) &&
    (brains.has("haji-core") || /\bhaji\b/.test(lower))
  ) {
    brains.add("allbee");
    brains.add("suplaykart");
  }
  // Legal is isolated — never auto-included in a multi-brain merge.
  brains.delete("legal");
  return brains.size >= 2 ? [...brains] : [];
}
