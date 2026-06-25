import type { ChatMessage, GenerateResult, ProviderName } from "./types";
import { listEnabledModels, type ModelEntry } from "./registry";
import { providers } from "./providers";

/**
 * Pure routing policy (no network) — easy to unit test.
 *
 * Rules:
 *   - Local development  → Ollama first
 *   - Production         → Gemini first
 *   - Fallback           → OpenRouter
 * A user-selected model (preferredModelId) is tried first when available;
 * the rest of the environment chain follows as fallbacks.
 */
export function planRoute(opts: {
  preferredModelId?: string;
  isProd: boolean;
  available: Record<ProviderName, boolean>;
}): ModelEntry[] {
  const enabled = listEnabledModels();
  const order: ProviderName[] = opts.isProd
    ? ["gemini", "openrouter", "ollama"]
    : ["ollama", "gemini", "openrouter"];

  const chain: ModelEntry[] = [];
  const pushFirstFor = (p: ProviderName) => {
    const entry = enabled.find((e) => e.provider === p && opts.available[p]);
    if (entry && !chain.includes(entry)) chain.push(entry);
  };

  // Preferred model first (if enabled and its provider is available).
  if (opts.preferredModelId) {
    const pref = enabled.find(
      (e) => e.modelId === opts.preferredModelId && opts.available[e.provider],
    );
    if (pref) chain.push(pref);
  }

  for (const p of order) pushFirstFor(p);
  return chain;
}

/** Execute the routed chain, falling back until a provider returns text. */
export async function routeChat(
  messages: ChatMessage[],
  opts: { preferredModelId?: string; jsonSchema?: Record<string, unknown> } = {},
): Promise<GenerateResult> {
  const available: Record<ProviderName, boolean> = {
    ollama: providers.ollama.isAvailable(),
    gemini: providers.gemini.isAvailable(),
    openrouter: providers.openrouter.isAvailable(),
  };

  const chain = planRoute({
    preferredModelId: opts.preferredModelId,
    isProd: process.env.NODE_ENV === "production",
    available,
  });

  let lastError: unknown;
  for (const entry of chain) {
    try {
      const text = await providers[entry.provider].generate(entry.model, messages, {
        jsonSchema: opts.jsonSchema,
      });
      if (text && text.trim()) {
        return { text, modelId: entry.modelId, provider: entry.provider };
      }
    } catch (error) {
      lastError = error;
    }
  }

  console.error("All AI providers failed:", lastError);
  return {
    text: "⚠️ HajiHaz could not reach any AI provider right now. Please try again.",
    modelId: "none",
    provider: "ollama",
  };
}
