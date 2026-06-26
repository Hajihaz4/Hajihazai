import type { NativeToolCall } from "./types";

/**
 * Pure parsers that normalize each provider's native tool-call response into
 * `NativeToolCall[]` (name + parsed arguments object). No network / side
 * effects — unit-testable.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function parseOllamaToolCalls(data: any): NativeToolCall[] {
  const calls = data?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls
    .map((c: any) => ({
      name: c?.function?.name,
      arguments: c?.function?.arguments ?? {},
    }))
    .filter((c: NativeToolCall) => typeof c.name === "string");
}

export function parseOpenAIToolCalls(data: any): NativeToolCall[] {
  const calls = data?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls
    .map((c: any) => {
      let args = c?.function?.arguments;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      return { name: c?.function?.name, arguments: args ?? {} };
    })
    .filter((c: NativeToolCall) => typeof c.name === "string");
}

export function parseGeminiToolCalls(data: any): NativeToolCall[] {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const calls: NativeToolCall[] = [];
  for (const p of parts) {
    if (p?.functionCall?.name) {
      calls.push({ name: p.functionCall.name, arguments: p.functionCall.args ?? {} });
    }
  }
  return calls;
}
