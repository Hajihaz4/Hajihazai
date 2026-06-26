import type {
  ChatMessage,
  GenerateOptions,
  NativeToolDefinition,
  Provider,
} from "../types";
import { parseOpenAIToolCalls } from "../tool-calls";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const openrouterProvider: Provider = {
  name: "openrouter",

  isAvailable() {
    return Boolean(process.env.OPENROUTER_API_KEY);
  },

  async generate(model, messages: ChatMessage[], opts?: GenerateOptions) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter: OPENROUTER_API_KEY missing");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "HajiHaz AI",
      },
      // OpenRouter is OpenAI-compatible — roles map 1:1.
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(opts?.jsonSchema ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  },

  async generateWithTools(model, messages: ChatMessage[], tools: NativeToolDefinition[]) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OpenRouter: OPENROUTER_API_KEY missing");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "HajiHaz AI",
      },
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
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
    const data = await res.json();
    return {
      text: data?.choices?.[0]?.message?.content ?? "",
      toolCalls: parseOpenAIToolCalls(data),
    };
  },
};
