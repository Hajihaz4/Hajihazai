import { describe, it, expect } from "vitest";
import { currentTimeTool } from "@/lib/tools/current-time";

describe("current_time (pure)", () => {
  it("returns iso, local, and timezone fields", async () => {
    const r = (await currentTimeTool.execute("u1", {})) as {
      iso: string;
      local: string;
      timezone: string;
    };
    expect(typeof r.iso).toBe("string");
    expect(typeof r.local).toBe("string");
    expect(typeof r.timezone).toBe("string");
    expect(r.timezone.length).toBeGreaterThan(0);
  });

  it("returns a valid, recent ISO timestamp", async () => {
    const r = (await currentTimeTool.execute("u1", {})) as { iso: string };
    const parsed = new Date(r.iso);
    expect(parsed.toString()).not.toBe("Invalid Date");
    expect(Math.abs(Date.now() - parsed.getTime())).toBeLessThan(60_000);
  });
});
