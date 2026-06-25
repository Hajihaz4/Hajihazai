import { z } from "zod";
import type { Tool } from "./types";
import { ToolError } from "./types";
import { semanticSearch } from "@/lib/memory/semantic-search";

export const SEARCH_QUERY_MAX_CHARS = 500;

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
  inputSchema: z.object({
    query: z
      .string()
      .min(1, "query is required")
      .max(SEARCH_QUERY_MAX_CHARS, `query must be ≤ ${SEARCH_QUERY_MAX_CHARS} characters`),
  }),
  async execute(userId, input) {
    const query = (input as { query?: unknown })?.query;
    if (typeof query !== "string" || !query.trim()) {
      throw new ToolError("input.query must be a non-empty string", "invalid_input");
    }
    const memories = await semanticSearch(userId, query);
    return { memories };
  },
};
