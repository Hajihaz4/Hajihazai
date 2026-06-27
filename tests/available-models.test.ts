import { describe, it, expect } from "vitest";
import { listAvailableModels } from "@/lib/ai/available-models";

describe("listAvailableModels (hide unavailable providers)", () => {
  it("includes the local Ollama model in development", () => {
    // Vitest runs with NODE_ENV=test (≠ production) → Ollama is available.
    const ids = listAvailableModels().map((m) => m.modelId);
    expect(ids).toContain("ollama:qwen2.5");
  });

  it("hides the local Ollama model in production (with a cloud key set)", () => {
    const env = process.env as Record<string, string | undefined>;
    const orig = {
      NODE_ENV: env.NODE_ENV,
      groq: env.GROQ_API_KEY,
      ollama: env.OLLAMA_BASE_URL,
    };
    try {
      env.NODE_ENV = "production";
      delete env.OLLAMA_BASE_URL;
      env.GROQ_API_KEY = "test-key";

      const ids = listAvailableModels().map((m) => m.modelId);
      expect(ids).not.toContain("ollama:qwen2.5");
      expect(ids.some((id) => id.startsWith("groq:"))).toBe(true);
    } finally {
      env.NODE_ENV = orig.NODE_ENV;
      if (orig.groq) env.GROQ_API_KEY = orig.groq;
      else delete env.GROQ_API_KEY;
      if (orig.ollama) env.OLLAMA_BASE_URL = orig.ollama;
      else delete env.OLLAMA_BASE_URL;
    }
  });

  it("never returns an empty list", () => {
    expect(listAvailableModels().length).toBeGreaterThan(0);
  });
});
