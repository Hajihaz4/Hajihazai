import { describe, it, expect, beforeAll, vi } from "vitest";

// Mock auth so we can drive the route's session without a request context.
let session: unknown = null;
vi.mock("@/auth", () => ({ auth: async () => session }));

// Route transitively imports the db client; gate on DATABASE_URL.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("tools API", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let POST: any;

  beforeAll(async () => {
    ({ POST } = await import("@/app/api/tools/route"));
  });

  const call = (body: unknown) =>
    POST(
      new Request("http://localhost/api/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  it("requires auth (401 when no session)", async () => {
    session = null;
    const res = await call({ tool: "calculator", input: { expression: "1+1" } });
    expect(res.status).toBe(401);
  });

  it("executes a deterministic tool when authed", async () => {
    session = { user: { id: "u1" } };
    const res = await call({
      tool: "calculator",
      input: { expression: "2+3*4" },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.output.result).toBe(14);
  });

  it("returns 404 for an unknown tool", async () => {
    session = { user: { id: "u1" } };
    const res = await call({ tool: "does_not_exist", input: {} });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe("unknown_tool");
  });

  it("returns 400 for invalid tool input", async () => {
    session = { user: { id: "u1" } };
    const res = await call({ tool: "calculator", input: { expression: 123 } });
    expect(res.status).toBe(400);
  });
});
