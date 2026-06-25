import { routeChat } from "@/lib/ai/router";
import { executeTool, getTool } from "./router";
import { exportToolSpecs } from "./specs";
import type { Tool } from "./types";

/**
 * Phase 8.2 — SINGLE tool calling.
 * The model decides whether to call exactly one tool; we execute it once (with
 * a timeout) and feed the result back as context. No loops, no recursion, no
 * multi-tool orchestration, no autonomous planning.
 */

export const TOOL_TIMEOUT_MS = 10_000;

export interface DetectedToolCall {
  tool: string;
  input: unknown;
}

export interface ToolExecution {
  toolRequested: DetectedToolCall | null;
  toolExecuted: boolean;
  toolResult: unknown | null;
  error?: string;
}

/** System prompt instructing the model to emit ONLY a JSON tool call or NO_TOOL. */
export function buildToolSelectionPrompt(): string {
  const specs = exportToolSpecs();
  return [
    "You decide whether ONE tool is needed to answer the user's message.",
    "Available tools and their JSON input schemas:",
    JSON.stringify(specs),
    'If a tool is needed, respond with ONLY a JSON object: {"tool": "<name>", "input": { ...args matching the tool schema }}.',
    "If no tool is needed, respond with exactly: NO_TOOL",
    "Return ONLY the JSON object or NO_TOOL. No explanations. No markdown.",
  ].join("\n");
}

/** Parse a model response into a tool call, or null (NO_TOOL / malformed). */
export function detectToolCall(text: string): DetectedToolCall | null {
  if (!text || typeof text !== "string") return null;
  const s = text.replace(/```(?:json)?/gi, "").trim();

  // Explicit no-tool sentinel (and no JSON object present).
  if (/^NO_TOOL\b/i.test(s) && !s.includes("{")) return null;

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.tool !== "string") return null;

  const input = obj.input ?? {};
  if (typeof input !== "object" || input === null) return null;

  return { tool: obj.tool, input };
}

/** Minimal JSON-schema validation: required keys present + primitive types. */
export function validateToolInput(
  tool: Tool,
  input: unknown,
): { ok: boolean; error?: string } {
  const required = tool.schema.required ?? [];
  if (required.length === 0) return { ok: true };

  if (input === null || typeof input !== "object") {
    return { ok: false, error: "input must be an object" };
  }
  const obj = input as Record<string, unknown>;
  for (const key of required) {
    if (!(key in obj) || obj[key] === undefined || obj[key] === null) {
      return { ok: false, error: `missing required field: ${key}` };
    }
    const prop = tool.schema.properties[key] as { type?: string } | undefined;
    if (prop?.type === "string" && typeof obj[key] !== "string") {
      return { ok: false, error: `${key} must be a string` };
    }
    if (prop?.type === "number" && typeof obj[key] !== "number") {
      return { ok: false, error: `${key} must be a number` };
    }
  }
  return { ok: true };
}

/** Race a promise against a timeout. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Tool timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Validate + execute a single detected tool call (one execution, with timeout). */
export async function executeDetectedToolCall(
  userId: string,
  call: DetectedToolCall,
  timeoutMs: number = TOOL_TIMEOUT_MS,
): Promise<Omit<ToolExecution, "toolRequested">> {
  const tool = getTool(call.tool);
  if (!tool) {
    return { toolExecuted: false, toolResult: null, error: `unknown tool: ${call.tool}` };
  }
  const valid = validateToolInput(tool, call.input);
  if (!valid.ok) {
    return { toolExecuted: false, toolResult: null, error: valid.error };
  }
  try {
    const result = await withTimeout(
      executeTool(userId, call.tool, call.input),
      timeoutMs,
    );
    return { toolExecuted: true, toolResult: result };
  } catch (err) {
    return {
      toolExecuted: false,
      toolResult: null,
      error: err instanceof Error ? err.message : "tool execution failed",
    };
  }
}

/**
 * Ask the model whether to call a tool and, if so, run exactly ONE.
 * `opts.decide` overrides the model decision (used by tests).
 */
export async function selectAndRunTool(
  userId: string,
  userMessage: string,
  opts: {
    decide?: (systemPrompt: string, message: string) => Promise<string>;
    timeoutMs?: number;
  } = {},
): Promise<ToolExecution> {
  const systemPrompt = buildToolSelectionPrompt();
  const decide =
    opts.decide ??
    (async (sys, msg) =>
      (
        await routeChat([
          { role: "system", content: sys },
          { role: "user", content: msg },
        ])
      ).text);

  let decisionText: string;
  try {
    decisionText = await decide(systemPrompt, userMessage);
  } catch {
    return { toolRequested: null, toolExecuted: false, toolResult: null };
  }

  const call = detectToolCall(decisionText);
  if (!call) {
    return { toolRequested: null, toolExecuted: false, toolResult: null };
  }

  // SINGLE execution — no loop.
  const exec = await executeDetectedToolCall(userId, call, opts.timeoutMs);
  return { toolRequested: call, ...exec };
}
