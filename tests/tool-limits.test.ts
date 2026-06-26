import { describe, it, expect } from "vitest";
import {
  validateToolInput,
  executeDetectedToolCall,
  selectAndRunTool,
} from "@/lib/tools/tool-calling";
import { getTool } from "@/lib/tools/registry";

describe("input limits + zod validation", () => {
  it("rejects calculator expression over 200 chars", () => {
    const tool = getTool("calculator")!;
    const long = "1+".repeat(150) + "1"; // > 200 chars
    expect(validateToolInput(tool, { expression: long }).ok).toBe(false);
    expect(validateToolInput(tool, { expression: "1+1" }).ok).toBe(true);
  });

  it("rejects memory_search query over 500 chars", () => {
    const tool = getTool("memory_search")!;
    expect(validateToolInput(tool, { query: "x".repeat(501) }).ok).toBe(false);
    expect(validateToolInput(tool, { query: "x".repeat(500) }).ok).toBe(true);
  });

  it("rejects knowledge_search query over 500 chars", () => {
    const tool = getTool("knowledge_search")!;
    expect(validateToolInput(tool, { query: "y".repeat(501) }).ok).toBe(false);
  });

  it("produces a friendly error for missing required field", () => {
    const r = validateToolInput(getTool("calculator")!, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });

  it("blocks execution when input exceeds the limit", async () => {
    const r = await executeDetectedToolCall("u1", {
      tool: "calculator",
      input: { expression: "9".repeat(300) },
    });
    expect(r.success).toBe(false);
    expect(r.status).toBe("rejected");
  });
});

describe("detection timeout", () => {
  it("continues with no tool when selection exceeds the timeout", async () => {
    const slowSelect = () =>
      new Promise<{ toolCalls: [] }>(() => {}); // never resolves
    const r = await selectAndRunTool("u1", "what is 2 + 2", {
      selectTools: slowSelect,
      detectTimeoutMs: 40,
    });
    expect(r.toolRequested).toBeNull();
    expect(r.toolExecuted).toBe(false);
  });
});
