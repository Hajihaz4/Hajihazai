/** Tool execution contracts (Phase 8.0). Deterministic tools only. */

export interface Tool {
  name: string;
  description: string;
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
