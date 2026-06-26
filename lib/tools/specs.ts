import { z } from "zod";
import { TOOLS } from "./registry";
import type { NativeToolDefinition } from "@/lib/ai/types";

/** Model-facing tool specification (JSON schema derived from the Zod schema). */
export interface ToolSpec {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

/** JSON schema for a tool, derived from its Zod input schema (single source). */
function jsonSchemaFor(toolIndex: number): Record<string, unknown> {
  return z.toJSONSchema(TOOLS[toolIndex].inputSchema) as Record<string, unknown>;
}

/** All tool specs (name + description + derived JSON schema). */
export function exportToolSpecs(): ToolSpec[] {
  return TOOLS.map((t, i) => ({
    name: t.name,
    description: t.description,
    schema: jsonSchemaFor(i),
  }));
}

/** Native tool definitions for provider function calling (parameters = JSON schema). */
export function toToolDefinitions(): NativeToolDefinition[] {
  return TOOLS.map((t, i) => ({
    name: t.name,
    description: t.description,
    parameters: jsonSchemaFor(i),
  }));
}
