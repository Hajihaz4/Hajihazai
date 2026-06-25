/** Tool execution contracts (Phase 8.0+). Deterministic tools only. */
import type { ZodType } from "zod";

export interface ToolSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface Tool {
  name: string;
  description: string;
  /** Model-facing JSON schema (for tool specs). */
  schema: ToolSchema;
  /** Zod schema used to validate input before execution (Phase 8.3). */
  inputSchema: ZodType;
  execute(userId: string, input: unknown): Promise<unknown>;
}

/** Thrown for unknown tools / invalid input — surfaced as typed API errors. */
export class ToolError extends Error {
  constructor(
    message: string,
    public code: "unknown_tool" | "invalid_input" | "execution_error",
  ) {
    super(message);
    this.name = "ToolError";
  }
}
