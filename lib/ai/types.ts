/** Shared contracts for the AI infrastructure layer. */

export type ProviderName = "ollama" | "gemini" | "openrouter";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateResult {
  text: string;
  modelId: string;
  provider: ProviderName;
}

export interface Provider {
  name: ProviderName;
  /** Whether this provider is usable in the current environment. */
  isAvailable(): boolean;
  /** Run a single non-streaming completion. Throws on transport/API error. */
  generate(model: string, messages: ChatMessage[]): Promise<string>;
}
