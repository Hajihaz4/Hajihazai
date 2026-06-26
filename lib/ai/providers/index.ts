import type { Provider, ProviderName } from "../types";
import { ollamaProvider } from "./ollama";
import { geminiProvider } from "./gemini";
import { openrouterProvider } from "./openrouter";
import { groqProvider } from "./groq";

export const providers: Record<ProviderName, Provider> = {
  ollama: ollamaProvider,
  gemini: geminiProvider,
  openrouter: openrouterProvider,
  groq: groqProvider,
};
