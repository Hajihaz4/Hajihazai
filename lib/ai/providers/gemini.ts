import type { ChatMessage, GenerateOptions, Provider } from "../types";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiProvider: Provider = {
  name: "gemini",

  isAvailable() {
    return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  },

  async generate(model, messages: ChatMessage[], opts?: GenerateOptions) {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) throw new Error("Gemini: GOOGLE_GENERATIVE_AI_API_KEY missing");

    // Gemini uses systemInstruction + roles user/model.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        // Force JSON output when a schema is requested.
        ...(opts?.jsonSchema
          ? { generationConfig: { responseMimeType: "application/json" } }
          : {}),
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);

    const data = await res.json();
    const parts: Array<{ text?: string }> =
      data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? "").join("");
  },
};
