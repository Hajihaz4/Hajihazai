import type { ChatMessage, GenerateOptions, Provider } from "../types";

const base = () => process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api";

export const ollamaProvider: Provider = {
  name: "ollama",

  // Local-first: always considered available in development; in production
  // only if a gateway URL is explicitly configured.
  isAvailable() {
    return process.env.NODE_ENV !== "production" || Boolean(process.env.OLLAMA_BASE_URL);
  },

  async generate(model, messages: ChatMessage[], opts?: GenerateOptions) {
    const body: Record<string, unknown> = { model, messages, stream: false };
    // Ollama supports structured outputs via a JSON schema in `format`.
    if (opts?.jsonSchema) body.format = opts.jsonSchema;

    const res = await fetch(`${base()}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const data = await res.json();
    return data?.message?.content ?? "";
  },
};
