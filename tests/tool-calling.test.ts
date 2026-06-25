import { describe, it, expect } from "vitest";
import {
  detectToolCall,
  validateToolInput,
  withTimeout,
  executeDetectedToolCall,
  selectAndRunTool,
} from "@/lib/tools/tool-calling";
import { getTool } from "@/lib/tools/registry";

describe("detectToolCall", () => {
  it("parses a strict JSON tool call", () => {
    const call = detectToolCall('{"tool":"calculator","input":{"expression":"475000 * 0.22"}}');
    expect(call).toEqual({
      tool: "calculator",
      input: { expression: "475000 * 0.22" },
    });
  });

  it("strips code fences", () => {
    const call = detectToolCall('```json\n{"tool":"current_time","input":{}}\n```');
    expect(call?.tool).toBe("current_time");
  });

  it("returns null for NO_TOOL", () => {
    expect(detectToolCall("NO_TOOL")).toBeNull();
    expect(detectToolCall("  NO_TOOL  ")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(detectToolCall("{not valid json")).toBeNull();
    expect(detectToolCall("just some prose")).toBeNull();
  });

  it("returns null when tool is not a string", () => {
    expect(detectToolCall('{"tool":123,"input":{}}')).toBeNull();
  });

  it("defaults input to an object when omitted", () => {
    const call = detectToolCall('{"tool":"current_time"}');
    expect(call).toEqual({ tool: "current_time", input: {} });
  });
});

describe("validateToolInput", () => {
  it("accepts valid input", () => {
    expect(validateToolInput(getTool("calculator")!, { expression: "1+1" }).ok).toBe(true);
  });
  it("rejects missing required field", () => {
    const r = validateToolInput(getTool("calculator")!, {});
    expect(r.ok).toBe(false);
  });
  it("rejects wrong type", () => {
    const r = validateToolInput(getTool("memory_search")!, { query: 5 });
    expect(r.ok).toBe(false);
  });
  it("accepts empty input for tools with no required fields", () => {
    expect(validateToolInput(getTool("current_time")!, {}).ok).toBe(true);
  });
});

describe("withTimeout", () => {
  it("resolves a fast promise", async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });
  it("rejects when the promise exceeds the timeout", async () => {
    const never = new Promise((r) => setTimeout(r, 5000));
    await expect(withTimeout(never, 30)).rejects.toThrow(/timed out/i);
  });
});

describe("executeDetectedToolCall (deterministic tools)", () => {
  it("executes calculator", async () => {
    const r = await executeDetectedToolCall("u1", {
      tool: "calculator",
      input: { expression: "475000 * 0.22" },
    });
    expect(r.toolExecuted).toBe(true);
    expect(r.toolResult).toEqual({ result: 104500 });
  });

  it("executes current_time", async () => {
    const r = await executeDetectedToolCall("u1", { tool: "current_time", input: {} });
    expect(r.toolExecuted).toBe(true);
    expect(typeof (r.toolResult as any).iso).toBe("string");
  });

  it("rejects an unknown tool", async () => {
    const r = await executeDetectedToolCall("u1", { tool: "rm_rf", input: {} });
    expect(r.toolExecuted).toBe(false);
    expect(r.error).toMatch(/unknown tool/i);
  });

  it("rejects invalid input", async () => {
    const r = await executeDetectedToolCall("u1", {
      tool: "calculator",
      input: {},
    });
    expect(r.toolExecuted).toBe(false);
  });
});

describe("selectAndRunTool (single execution, model decision injected)", () => {
  it("runs no tool when the model says NO_TOOL", async () => {
    const r = await selectAndRunTool("u1", "hello there", {
      decide: async () => "NO_TOOL",
    });
    expect(r.toolRequested).toBeNull();
    expect(r.toolExecuted).toBe(false);
  });

  it("runs exactly one tool when the model requests one", async () => {
    const r = await selectAndRunTool("u1", "what is 475000 * 0.22", {
      decide: async () =>
        '{"tool":"calculator","input":{"expression":"475000 * 0.22"}}',
    });
    expect(r.toolRequested?.tool).toBe("calculator");
    expect(r.toolExecuted).toBe(true);
    // single result object — not an array of multiple executions
    expect(Array.isArray(r.toolResult)).toBe(false);
    expect(r.toolResult).toEqual({ result: 104500 });
  });

  it("rejects an unknown tool requested by the model", async () => {
    const r = await selectAndRunTool("u1", "do something", {
      decide: async () => '{"tool":"shell","input":{"cmd":"ls"}}',
    });
    expect(r.toolRequested?.tool).toBe("shell");
    expect(r.toolExecuted).toBe(false);
  });

  it("treats malformed model output as no tool", async () => {
    const r = await selectAndRunTool("u1", "hi", {
      decide: async () => "garbage {not json",
    });
    expect(r.toolRequested).toBeNull();
    expect(r.toolExecuted).toBe(false);
  });
});
