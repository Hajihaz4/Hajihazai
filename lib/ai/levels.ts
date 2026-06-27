import { MODEL_REGISTRY } from "./registry";
import { isModelUsable } from "./health";

/**
 * Capability levels shown to users instead of raw provider/model names.
 *
 * Each level has a `primary` model (its natural tier) and a `chain` of
 * fallbacks. The UI shows a level only when its primary is usable; if a
 * picked level's primary later fails, routing remaps down the chain to the
 * next healthy model. Users never see provider names or which model ran.
 */

export type Level = "low" | "medium" | "high" | "max";

export interface LevelDef {
  level: Level;
  label: string;
  primary: string;
  /** Ordered fallback chain (primary first). */
  chain: string[];
}

export const LEVELS: LevelDef[] = [
  {
    level: "low",
    label: "Low",
    primary: "openrouter:qwen-2.5-7b",
    chain: ["openrouter:qwen-2.5-7b", "groq:llama-3.3-70b", "gemini:2.0-flash"],
  },
  {
    level: "medium",
    label: "Medium",
    primary: "groq:llama-3.3-70b",
    chain: ["groq:llama-3.3-70b", "openrouter:qwen-2.5-7b", "gemini:2.0-flash"],
  },
  {
    level: "high",
    label: "High",
    primary: "groq:deepseek-r1-70b",
    chain: [
      "groq:deepseek-r1-70b",
      "groq:qwen-qwq-32b",
      "groq:llama-3.3-70b",
      "openrouter:qwen-2.5-7b",
    ],
  },
  {
    level: "max",
    label: "Max",
    primary: "gemini:2.0-flash",
    chain: ["gemini:2.0-flash", "groq:llama-3.3-70b", "openrouter:qwen-2.5-7b"],
  },
];

type Usable = (modelId: string) => boolean;
const defaultUsable: Usable = (id) => isModelUsable(id);

const has = (id: string) => MODEL_REGISTRY.some((m) => m.modelId === id);

/** Levels whose primary model is currently usable (for the selector). */
export function listHealthyLevels(
  usable: Usable = defaultUsable,
): { level: Level; label: string }[] {
  return LEVELS.filter((d) => has(d.primary) && usable(d.primary)).map(
    ({ level, label }) => ({ level, label }),
  );
}

/** Resolve a level to the first usable model in its chain, or null. */
export function resolveLevel(level: Level, usable: Usable = defaultUsable): string | null {
  const def = LEVELS.find((l) => l.level === level);
  if (!def) return null;
  for (const id of def.chain) {
    if (has(id) && usable(id)) return id;
  }
  return null;
}

export function isLevel(v: unknown): v is Level {
  return v === "low" || v === "medium" || v === "high" || v === "max";
}
