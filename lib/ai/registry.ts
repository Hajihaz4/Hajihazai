import type { ProviderName } from "./types";

/**
 * Model registry — the single source of truth for selectable models.
 * Pure data (no secrets), so it is safe to import in client components
 * to render the model selector.
 */
export interface ModelEntry {
  modelId: string; // HajiHaz-facing id / registry key
  provider: ProviderName;
  model: string; // provider-native model name used in the API call
  displayName: string;
  contextWindow: number;
  enabled: boolean;
}

export const MODEL_REGISTRY: ModelEntry[] = [
  {
    modelId: "ollama:qwen2.5",
    provider: "ollama",
    model: "qwen2.5:1.5b-instruct",
    displayName: "Qwen 2.5 (Local)",
    contextWindow: 32_768,
    enabled: true,
  },
  {
    modelId: "gemini:1.5-flash",
    provider: "gemini",
    model: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    contextWindow: 1_000_000,
    enabled: true,
  },
  {
    modelId: "openrouter:qwen-2.5-7b",
    provider: "openrouter",
    model: "qwen/qwen-2.5-7b-instruct",
    displayName: "Qwen 2.5 7B (OpenRouter)",
    contextWindow: 32_768,
    enabled: true,
  },
];

export function listEnabledModels(): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.enabled);
}
