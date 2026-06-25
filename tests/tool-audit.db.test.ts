import { describe, it, expect, beforeAll, afterAll } from "vitest";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("tool invocation audit (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let toolQ: any;
  let tc: any;
  let A = "";
  let B = "";

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    toolQ = await import("@/lib/db/tool-queries");
    tc = await import("@/lib/tools/tool-calling");

    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const mk = async (email: string) =>
      (await db.insert(schema.users).values({ email }).returning())[0].id;
    A = await mk(`audit-A-${s}@example.com`);
    B = await mk(`audit-B-${s}@example.com`);
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("records an audit row for an executed tool", async () => {
    await tc.selectAndRunTool(A, "compute it", {
      decide: async () =>
        '{"tool":"calculator","input":{"expression":"475000 * 0.22"}}',
      audit: true,
    });

    const rows = await toolQ.listToolInvocations(A);
    expect(rows.length).toBe(1);
    expect(rows[0].toolName).toBe("calculator");
    expect(rows[0].status).toBe("success");
    expect(typeof rows[0].durationMs).toBe("number");
  });

  it("does NOT audit when audit flag is off", async () => {
    await tc.selectAndRunTool(B, "compute it", {
      decide: async () =>
        '{"tool":"calculator","input":{"expression":"1+1"}}',
      audit: false,
    });
    const rows = await toolQ.listToolInvocations(B);
    expect(rows.length).toBe(0);
  });

  it("isolates audit history per user", async () => {
    const aRows = await toolQ.listToolInvocations(A);
    const bRows = await toolQ.listToolInvocations(B);
    expect(aRows.every((r: any) => r.toolName === "calculator")).toBe(true);
    expect(bRows.length).toBe(0); // B never audited
  });

  it("recordToolInvocation is best-effort (no throw on FK violation)", async () => {
    // A non-existent user id violates the FK; must be swallowed, not thrown.
    await expect(
      toolQ.recordToolInvocation({
        userId: "does-not-exist",
        toolName: "calculator",
        input: {},
        output: {},
        status: "success",
        durationMs: 1,
      }),
    ).resolves.toBeUndefined();
  });
});
