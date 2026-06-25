import type { EmbeddingProvider, EmbeddingProviderName } from "../types";
import { ollamaEmbeddingProvider } from "./ollama";
import { geminiEmbeddingProvider } from "./gemini";
import { openrouterEmbeddingProvider } from "./openrouter";

export const embeddingProviders: Record<EmbeddingProviderName, EmbeddingProvider> = {
  ollama: ollamaEmbeddingProvider,
  gemini: geminiEmbeddingProvider,
  openrouter: openrouterEmbeddingProvider,
};
