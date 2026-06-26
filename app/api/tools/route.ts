import { auth } from "@/auth";
import { listTools } from "@/lib/tools/registry";
import { executeDetectedToolCall } from "@/lib/tools/tool-calling";
import { recordToolInvocation } from "@/lib/db/tool-queries";
import { rateLimit } from "@/lib/ratelimit";

/** List available tools (developer convenience). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ tools: listTools() });
}

/** Execute a tool: { tool, input }. Validated (Zod), audited, timeout-bounded. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const limited = rateLimit(`tools:${session.user.id}`, 60, 60_000);
  if (!limited.ok) {
    return new Response("Too many tool requests. Please wait.", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((limited.retryAfterMs ?? 1000) / 1000)),
      },
    });
  }

  const body = await req.json().catch(() => null);
  const tool = body?.tool;
  const input = body?.input;
  if (typeof tool !== "string") {
    return new Response("tool must be a string", { status: 400 });
  }

  const run = await executeDetectedToolCall(session.user.id, { tool, input });

  // Best-effort audit for actual executions (not validation rejections).
  if (run.status !== "rejected") {
    await recordToolInvocation({
      userId: session.user.id,
      toolName: tool,
      input,
      output: run.result,
      status: run.status,
      durationMs: run.durationMs,
      error: run.error,
    });
  }

  if (run.success) {
    return Response.json({ tool, output: run.result });
  }

  if (run.status === "rejected") {
    if ((run.error ?? "").startsWith("unknown tool")) {
      return Response.json(
        { error: run.error, code: "unknown_tool" },
        { status: 404 },
      );
    }
    return Response.json(
      { error: run.error, code: "invalid_input" },
      { status: 400 },
    );
  }

  // execution error / timeout
  return Response.json(
    { error: run.error, code: run.status },
    { status: run.status === "timeout" ? 504 : 500 },
  );
}
