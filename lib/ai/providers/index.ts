import type { Provider, ProviderName } from "../types";
import { ollamaProvider } from "./ollama";
import { geminiProvider } from "./gemini";
import { openrouterProvider } from "./openrouter";

export const providers: Record<ProviderName, Provider> = {
  ollama: ollamaProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
};
