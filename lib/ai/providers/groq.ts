import type {
  ChatMessage,
  GenerateOptions,
  NativeToolDefinition,
  Provider,
} from "../types";
import { parseOpenAIToolCalls } from "../tool-calls";

/**
 * Groq — OpenAI-compatible chat completions (fast inference). Chat only;
 * Groq has no embeddings API. Supports native function calling.
 */
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function authHeaders(): Record<string, string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq: GROQ_API_KEY missing");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
}

export const groqProvider: Provider = {
  name: "groq",

  isAvailable() {
    return Boolean(process.env.GROQ_API_KEY);
  },

  async generate(model, messages: ChatMessage[], opts?: GenerateOptions) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(opts?.jsonSchema ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },

  async generateWithTools(model, messages: ChatMessage[], tools: NativeToolDefinition[]) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        tool_choice: "auto",
        tools: tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      }),
    });
    if (!res.ok) throw new Error(`Groq error ${res.status}`);
    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? "",
      toolCalls: parseOpenAIToolCalls(data),
    };
  },
};
