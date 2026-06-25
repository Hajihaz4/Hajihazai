import { describe, it, expect, beforeAll } from "vitest";
import {
  planEmbeddingRoute,
  embed,
} from "@/lib/ai/embeddings/router";
import {
  EMBEDDING_DIMENSIONS,
  embeddingDimensionsConsistent,
  listEnabledEmbeddingModels,
} from "@/lib/ai/embeddings/registry";
import { embeddingProviders } from "@/lib/ai/embeddings/providers";

const ALL = { ollama: true, gemini: true, openrouter: true };

describe("embedding router (pure)", () => {
  it("dev → Ollama first", () => {
    const chain = planEmbeddingRoute({ isProd: false, available: ALL });
    expect(chain[0]?.provider).toBe("ollama");
  });

  it("prod → Gemini first, OpenRouter as fallback", () => {
    const chain = planEmbeddingRoute({
      isProd: true,
      available: { ollama: false, gemini: true, openrouter: true },
    });
    expect(chain[0]?.provider).toBe("gemini");
    expect(chain.some((e) => e.provider === "openrouter")).toBe(true);
  });

  it("prod, Gemini down → OpenRouter fallback", () => {
    const chain = planEmbeddingRoute({
      isProd: true,
      available: { ollama: false, gemini: false, openrouter: true },
    });
    expect(chain[0]?.provider).toBe("openrouter");
  });

  it("preferred model is tried first", () => {
    const chain = planEmbeddingRoute({
      preferredModelId: "openrouter:nomic-embed-text",
      isProd: false,
      available: ALL,
    });
    expect(chain[0]?.modelId).toBe("openrouter:nomic-embed-text");
    // not duplicated
    expect(
      chain.filter((e) => e.modelId === "openrouter:nomic-embed-text").length,
    ).toBe(1);
  });

  it("no providers available → empty chain", () => {
    const chain = planEmbeddingRoute({
      isProd: false,
      available: { ollama: false, gemini: false, openrouter: false },
    });
    expect(chain.length).toBe(0);
  });
});

describe("embedding registry (dimension consistency)", () => {
  it("every enabled model shares the canonical dimension", () => {
    expect(embeddingDimensionsConsistent()).toBe(true);
    expect(
      listEnabledEmbeddingModels().every(
        (m) => m.dimensions === EMBEDDING_DIMENSIONS,
      ),
    ).toBe(true);
  });
});

describe("provider availability", () => {
  it("reflects environment configuration", () => {
    const orig = {
      gemini: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    };
    try {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      expect(embeddingProviders.gemini.isAvailable()).toBe(false);
      expect(embeddingProviders.openrouter.isAvailable()).toBe(false);

      process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
      process.env.OPENROUTER_API_KEY = "test-key";
      expect(embeddingProviders.gemini.isAvailable()).toBe(true);
      expect(embeddingProviders.openrouter.isAvailable()).toBe(true);
    } finally {
      if (orig.gemini) process.env.GOOGLE_GENERATIVE_AI_API_KEY = orig.gemini;
      else delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (orig.openrouter) process.env.OPENROUTER_API_KEY = orig.openrouter;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });
});

describe("live embedding generation (Ollama)", () => {
  let ready = false;

  beforeAll(async () => {
    try {
      const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api";
      const res = await fetch(`${base}/tags`);
      const data = await res.json();
      ready =
        res.ok &&
        Array.isArray(data?.models) &&
        data.models.some((m: { name: string }) =>
          m.name.includes("nomic-embed-text"),
        );
    } catch {
      ready = false;
    }
  });

  it("generates a canonical-dimension embedding through the router", async () => {
    if (!ready) {
      console.warn("  (skipped — nomic-embed-text not available in Ollama)");
      return;
    }
    const r = await embed("HajiHaz embedding infrastructure test");
    expect(r.provider).toBe("ollama");
    expect(r.modelId).toBe("ollama:nomic-embed-text");
    expect(Array.isArray(r.embedding)).toBe(true);
    expect(r.embedding.length).toBe(EMBEDDING_DIMENSIONS);
    // dimension consistency: reported dims === actual vector length
    expect(r.dimensions).toBe(r.embedding.length);
  });
});
