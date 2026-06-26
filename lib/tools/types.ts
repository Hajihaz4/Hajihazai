/** Tool execution contracts (Phase 8.0+). Deterministic tools only. */
import type { ZodType } from "zod";

export interface Tool {
  name: string;
  description: string;
  /**
   * Zod schema = the SINGLE source of truth for input shape (Phase 8.4).
   * The model-facing JSON schema is derived from this via z.toJSONSchema.
   */
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
