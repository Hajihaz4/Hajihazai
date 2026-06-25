import { TOOLS } from "./registry";
import type { ToolSchema } from "./types";

/** Model-facing tool specification (name + description + JSON schema). */
export interface ToolSpec {
  name: string;
  description: string;
  schema: ToolSchema;
}

/** All tool specs — consumed by the tool-calling layer. */
export function exportToolSpecs(): ToolSpec[] {
  return TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema,
  }));
}
