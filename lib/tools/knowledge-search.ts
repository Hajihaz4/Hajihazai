import type { Tool } from "./types";
import { ToolError } from "./types";
import { semanticDocumentSearch } from "@/lib/knowledge/semantic-search";

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
  async execute(userId, input) {
    const query = (input as { query?: unknown })?.query;
    if (typeof query !== "string" || !query.trim()) {
      throw new ToolError("input.query must be a non-empty string", "invalid_input");
    }
    const chunks = await semanticDocumentSearch(userId, query);
    return { chunks };
  },
};
