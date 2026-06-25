import type { Tool } from "./types";
import { ToolError } from "./types";
import { semanticSearch } from "@/lib/memory/semantic-search";

/**
 * Memory search tool — thin wrapper over the EXISTING semantic memory search.
 * No new retrieval logic; user-scoped via semanticSearch(userId, ...).
 * Input: { query: string }.
 */
export const memorySearchTool: Tool = {
  name: "memory_search",
  description:
    "Search the user's long-term memories semantically. Input: { query: string }.",
  schema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  },
  async execute(userId, input) {
    const query = (input as { query?: unknown })?.query;
    if (typeof query !== "string" || !query.trim()) {
      throw new ToolError("input.query must be a non-empty string", "invalid_input");
    }
    const memories = await semanticSearch(userId, query);
    return { memories };
  },
};
