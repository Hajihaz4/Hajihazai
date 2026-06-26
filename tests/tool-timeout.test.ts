import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

// Mock the tool router so the executed tool hangs — deterministically forcing
// the 10s-timeout branch (tested here with a small timeout).
vi.mock("@/lib/tools/router", () => ({
  getTool: () => ({
    name: "slow",
    description: "",
    inputSchema: z.object({}),
    execute: async () => undefined,
  }),
  executeTool: () => new Promise(() => {}), // never resolves
}));

// tool-calling transitively imports the db client; gate on DATABASE_URL and
// import lazily so the file loads even without a connection string.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("tool timeout", () => {
  it("times out a slow tool execution gracefully", async () => {
    const { executeDetectedToolCall } = await import("@/lib/tools/tool-calling");
    const r = await executeDetectedToolCall("u1", { tool: "slow", input: {} }, 50);
    expect(r.success).toBe(false);
    expect(r.status).toBe("timeout");
    expect(r.error).toMatch(/timed out/i);
  });
});
