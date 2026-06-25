import type { Tool } from "./types";

/**
 * Returns the server's current time. Deterministic in shape (not value).
 * No external API.
 */
export const currentTimeTool: Tool = {
  name: "current_time",
  description: "Return the current server time. Input: {} (none required).",
  async execute() {
    const now = new Date();
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    return {
      iso: now.toISOString(),
      local: now.toLocaleString("en-US", { timeZone: timezone }),
      timezone,
    };
  },
};
