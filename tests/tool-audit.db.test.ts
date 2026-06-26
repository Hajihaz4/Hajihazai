import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { desc, eq } from "drizzle-orm";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("tool invocation audit (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let toolQ: any;
  let tc: any;
  let A = "";
  let B = "";

  const calcSelect = (expr: string) => async () => ({
    toolCalls: [{ name: "calculator", arguments: { expression: expr } }],
  });

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

  it("records an audit row (with sizes) for an executed tool", async () => {
    await tc.selectAndRunTool(A, "compute it", {
      selectTools: calcSelect("475000 * 0.22"),
      audit: true,
    });

    const rows = await toolQ.listToolInvocations(A);
    expect(rows.length).toBe(1);
    expect(rows[0].toolName).toBe("calculator");
    expect(rows[0].status).toBe("success");
    expect(typeof rows[0].durationMs).toBe("number");
    expect(rows[0].inputSize).toBeGreaterThan(0);
    expect(rows[0].outputSize).toBeGreaterThan(0);
  });

  it("does NOT audit when audit flag is off", async () => {
    await tc.selectAndRunTool(B, "compute it", {
      selectTools: calcSelect("1+1"),
      audit: false,
    });
    expect((await toolQ.listToolInvocations(B)).length).toBe(0);
  });

  it("isolates audit history per user + paginates", async () => {
    const aRows = await toolQ.listToolInvocations(A, { limit: 10, offset: 0 });
    expect(aRows.every((r: any) => r.toolName === "calculator")).toBe(true);
    expect(await toolQ.countToolInvocations(B)).toBe(0);
  });

  it("caps oversized payloads but records true size", async () => {
    const big = "x".repeat(5000);
    await toolQ.recordToolInvocation({
      userId: A,
      toolName: "memory_search",
      input: { query: "q" },
      output: { big },
      status: "success",
      durationMs: 5,
    });
    const [{ output, outputSize }] = await db
      .select({ output: schema.toolInvocation.output, outputSize: schema.toolInvocation.outputSize })
      .from(schema.toolInvocation)
      .where(eq(schema.toolInvocation.userId, A))
      .orderBy(desc(schema.toolInvocation.createdAt))
      .limit(1);
    expect(outputSize).toBeGreaterThan(2000);
    expect((output as any)._truncated).toBe(true);
  });

  it("recordToolInvocation is best-effort (no throw on FK violation)", async () => {
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
