import type { EmbeddingProviderName } from "./types";

/**
 * Embedding model registry. Pure data (no secrets) — safe to import anywhere.
 *
 * Canonical dimension is shared across every enabled provider so vectors are
 * interchangeable/co-rankable regardless of which provider produced them.
 */
export const EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingModelEntry {
  modelId: string; // HajiHaz-facing id / registry key
  provider: EmbeddingProviderName;
  model: string; // provider-native model name
  dimensions: number;
  enabled: boolean;
}

export const EMBEDDING_REGISTRY: EmbeddingModelEntry[] = [
  {
    modelId: "ollama:nomic-embed-text",
    provider: "ollama",
    model: "nomic-embed-text",
    dimensions: 768,
    enabled: true,
  },
  {
    modelId: "gemini:text-embedding-004",
    provider: "gemini",
    model: "text-embedding-004",
    dimensions: 768,
    enabled: true,
  },
  {
    modelId: "openrouter:nomic-embed-text",
    provider: "openrouter",
    model: "nomic-ai/nomic-embed-text-v1.5",
    dimensions: 768,
    enabled: true,
  },
];

export function listEnabledEmbeddingModels(): EmbeddingModelEntry[] {
  return EMBEDDING_REGISTRY.filter((m) => m.enabled);
}

/** True if every enabled model declares the canonical dimension. */
export function embeddingDimensionsConsistent(): boolean {
  return listEnabledEmbeddingModels().every(
    (m) => m.dimensions === EMBEDDING_DIMENSIONS,
  );
}
