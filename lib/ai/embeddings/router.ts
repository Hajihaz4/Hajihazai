import type { EmbedResult, EmbeddingProviderName } from "./types";
import { listEnabledEmbeddingModels, type EmbeddingModelEntry } from "./registry";
import { embeddingProviders } from "./providers";

/**
 * Pure routing policy (no network) — easy to unit test.
 *
 * Rules:
 *   - Local development  → Ollama first
 *   - Production         → Gemini first
 *   - Fallback           → OpenRouter
 * A preferred model is tried first when its provider is available.
 */
export function planEmbeddingRoute(opts: {
  preferredModelId?: string;
  isProd: boolean;
  available: Record<EmbeddingProviderName, boolean>;
}): EmbeddingModelEntry[] {
  const enabled = listEnabledEmbeddingModels();
  const order: EmbeddingProviderName[] = opts.isProd
    ? ["gemini", "openrouter", "ollama"]
    : ["ollama", "gemini", "openrouter"];

  const chain: EmbeddingModelEntry[] = [];
  const pushFirstFor = (p: EmbeddingProviderName) => {
    const entry = enabled.find((e) => e.provider === p && opts.available[p]);
    if (entry && !chain.includes(entry)) chain.push(entry);
  };

  if (opts.preferredModelId) {
    const pref = enabled.find(
      (e) => e.modelId === opts.preferredModelId && opts.available[e.provider],
    );
    if (pref) chain.push(pref);
  }

  for (const p of order) pushFirstFor(p);
  return chain;
}

/** Execute the routed chain, falling back until a provider returns a vector. */
export async function embed(
  text: string,
  opts: { preferredModelId?: string } = {},
): Promise<EmbedResult> {
  const available: Record<EmbeddingProviderName, boolean> = {
    ollama: embeddingProviders.ollama.isAvailable(),
    gemini: embeddingProviders.gemini.isAvailable(),
    openrouter: embeddingProviders.openrouter.isAvailable(),
  };

  const chain = planEmbeddingRoute({
    preferredModelId: opts.preferredModelId,
    isProd: process.env.NODE_ENV === "production",
    available,
  });

  let lastError: unknown;
  for (const entry of chain) {
    try {
      const vector = await embeddingProviders[entry.provider].embed(
        entry.model,
        text,
      );
      if (Array.isArray(vector) && vector.length > 0) {
        return {
          embedding: vector,
          modelId: entry.modelId,
          provider: entry.provider,
          dimensions: vector.length,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `All embedding providers failed: ${
      lastError instanceof Error ? lastError.message : "no provider available"
    }`,
  );
}
