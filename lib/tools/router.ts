import { getTool } from "./registry";
import { ToolError } from "./types";

export { getTool } from "./registry";

/**
 * Execute a tool by name with validation + typed errors.
 * Throws ToolError("unknown_tool") for an unregistered tool and re-throws
 * ToolErrors from the tool; any other failure becomes "execution_error".
 */
export async function executeTool(
  userId: string,
  toolName: unknown,
  input: unknown,
): Promise<unknown> {
  if (typeof toolName !== "string" || !toolName) {
    throw new ToolError("tool name must be a non-empty string", "invalid_input");
  }
  const tool = getTool(toolName);
  if (!tool) {
    throw new ToolError(`Unknown tool: ${toolName}`, "unknown_tool");
  }

  try {
    return await tool.execute(userId, input);
  } catch (err) {
    if (err instanceof ToolError) throw err;
    throw new ToolError(
      err instanceof Error ? err.message : "Tool execution failed",
      "execution_error",
    );
  }
}
