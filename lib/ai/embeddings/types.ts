/** Contracts for the embedding infrastructure layer. */

export type EmbeddingProviderName = "ollama" | "gemini" | "openrouter";

export interface EmbedResult {
  embedding: number[];
  modelId: string;
  provider: EmbeddingProviderName;
  dimensions: number;
}

export interface EmbeddingProvider {
  name: EmbeddingProviderName;
  /** Whether this provider is usable in the current environment. */
  isAvailable(): boolean;
  /** Embed a single text. Throws on transport/API error. */
  embed(model: string, text: string): Promise<number[]>;
}
