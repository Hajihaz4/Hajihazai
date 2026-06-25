import { z } from "zod";
import type { Tool } from "./types";
import { ToolError } from "./types";
import { semanticDocumentSearch } from "@/lib/knowledge/semantic-search";
import { SEARCH_QUERY_MAX_CHARS } from "./memory-search";

/**
 * Knowledge search tool — thin wrapper over the EXISTING semantic document
 * search. No new search system; user-scoped + active/owned docs only via
 * semanticDocumentSearch(userId, ...).
 * Input: { query: string }.
 */
export const knowledgeSearchTool: Tool = {
  name: "knowledge_search",
  description:
    "Search the user's knowledge base semantically. Input: { query: string }.",
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
    const chunks = await semanticDocumentSearch(userId, query);
    return { chunks };
  },
};
