import { routeChat } from "@/lib/ai/router";
import { executeTool, getTool } from "./router";
import { exportToolSpecs } from "./specs";
import { recordToolInvocation } from "@/lib/db/tool-queries";
import type { Tool } from "./types";

/**
 * Phase 8.3 — Hardened single tool calling.
 * One tool max per turn. Zod-validated input, 10s execution timeout, 5s
 * detection timeout, duration/status tracking, and best-effort audit.
 * No loops, recursion, or multi-tool orchestration.
 */

export const TOOL_TIMEOUT_MS = 10_000;
export const DETECTION_TIMEOUT_MS = 5_000;

export interface DetectedToolCall {
  tool: string;
  input: unknown;
}

export type ToolStatus = "success" | "error" | "timeout" | "rejected";

export interface ToolExecution {
  toolRequested: DetectedToolCall | null;
  toolExecuted: boolean;
  toolResult: unknown | null;
  status?: ToolStatus;
  durationMs?: number;
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

/** Validate input with the tool's Zod schema. Friendly error message. */
export function validateToolInput(
  tool: Tool,
  input: unknown,
): { ok: true; data: unknown } | { ok: false; error: string } {
  const parsed = tool.inputSchema.safeParse(input ?? {});
  if (parsed.success) return { ok: true, data: parsed.data };
  const first = parsed.error.issues[0];
  const path = first?.path?.join(".");
  const message = first?.message ?? "invalid input";
  return { ok: false, error: path ? `${path}: ${message}` : message };
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
    return {
      toolExecuted: false,
      toolResult: null,
      status: "rejected",
      error: `unknown tool: ${call.tool}`,
    };
  }

  const valid = validateToolInput(tool, call.input);
  if (!valid.ok) {
    return {
      toolExecuted: false,
      toolResult: null,
      status: "rejected",
      error: valid.error,
    };
  }

  const start = Date.now();
  try {
    const result = await withTimeout(
      executeTool(userId, call.tool, valid.data),
      timeoutMs,
    );
    return {
      toolExecuted: true,
      toolResult: result,
      status: "success",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "tool execution failed";
    return {
      toolExecuted: false,
      toolResult: null,
      status: /timed out/i.test(message) ? "timeout" : "error",
      durationMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * Ask the model whether to call a tool and, if so, run exactly ONE.
 * - Detection model call is bounded by `detectTimeoutMs` (default 5s); on
 *   timeout we continue with no tool (no crash).
 * - When `audit` is true, the execution (success/error/timeout) is recorded.
 * - `opts.decide` overrides the model decision (tests).
 */
export async function selectAndRunTool(
  userId: string,
  userMessage: string,
  opts: {
    decide?: (systemPrompt: string, message: string) => Promise<string>;
    timeoutMs?: number;
    detectTimeoutMs?: number;
    audit?: boolean;
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
    decisionText = await withTimeout(
      decide(systemPrompt, userMessage),
      opts.detectTimeoutMs ?? DETECTION_TIMEOUT_MS,
    );
  } catch {
    // Detection timed out or errored → continue normal chat, no tool.
    return { toolRequested: null, toolExecuted: false, toolResult: null };
  }

  const call = detectToolCall(decisionText);
  if (!call) {
    return { toolRequested: null, toolExecuted: false, toolResult: null };
  }

  // SINGLE execution — no loop.
  const exec = await executeDetectedToolCall(userId, call, opts.timeoutMs);

  // Best-effort audit (only for actual executions, not rejections).
  if (opts.audit && exec.status && exec.status !== "rejected") {
    await recordToolInvocation({
      userId,
      toolName: call.tool,
      input: call.input,
      output: exec.toolResult,
      status: exec.status,
      durationMs: exec.durationMs ?? 0,
      error: exec.error,
    });
  }

  return { toolRequested: call, ...exec };
}
