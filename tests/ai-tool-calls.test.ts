import { describe, it, expect } from "vitest";
import {
  parseOllamaToolCalls,
  parseOpenAIToolCalls,
  parseGeminiToolCalls,
} from "@/lib/ai/tool-calls";

describe("native tool-call parsers", () => {
  it("parses Ollama tool_calls (arguments already object)", () => {
    const data = {
      message: {
        tool_calls: [
          { function: { name: "calculator", arguments: { expression: "1+1" } } },
        ],
      },
    };
    expect(parseOllamaToolCalls(data)).toEqual([
      { name: "calculator", arguments: { expression: "1+1" } },
    ]);
  });

  it("returns [] for Ollama with no tool_calls", () => {
    expect(parseOllamaToolCalls({ message: { content: "hi" } })).toEqual([]);
    expect(parseOllamaToolCalls({})).toEqual([]);
  });

  it("parses OpenAI/OpenRouter tool_calls (arguments JSON string)", () => {
    const data = {
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "memory_search",
                  arguments: '{"query":"acme"}',
                },
              },
            ],
          },
        },
      ],
    };
    expect(parseOpenAIToolCalls(data)).toEqual([
      { name: "memory_search", arguments: { query: "acme" } },
    ]);
  });

  it("falls back to {} on malformed OpenAI arguments", () => {
    const data = {
      choices: [
        { message: { tool_calls: [{ function: { name: "x", arguments: "not json" } }] } },
      ],
    };
    expect(parseOpenAIToolCalls(data)).toEqual([{ name: "x", arguments: {} }]);
  });

  it("parses Gemini functionCall parts", () => {
    const data = {
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: "current_time", args: {} } },
              { text: "ignored" },
            ],
          },
        },
      ],
    };
    expect(parseGeminiToolCalls(data)).toEqual([
      { name: "current_time", arguments: {} },
    ]);
  });

  it("returns [] for Gemini with no functionCall", () => {
    expect(
      parseGeminiToolCalls({ candidates: [{ content: { parts: [{ text: "hi" }] } }] }),
    ).toEqual([]);
  });

  it("parses multiple Ollama tool_calls preserving order", () => {
    const data = {
      message: {
        tool_calls: [
          { function: { name: "calculator", arguments: { expression: "1" } } },
          { function: { name: "current_time", arguments: {} } },
        ],
      },
    };
    const calls = parseOllamaToolCalls(data);
    expect(calls.map((c) => c.name)).toEqual(["calculator", "current_time"]);
  });

  it("filters out calls without a name", () => {
    const data = {
      message: {
        tool_calls: [
          { function: { arguments: {} } },
          { function: { name: "calculator", arguments: {} } },
        ],
      },
    };
    expect(parseOllamaToolCalls(data).map((c) => c.name)).toEqual(["calculator"]);
  });
});
