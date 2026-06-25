import { auth } from "@/auth";
import { executeTool } from "@/lib/tools/router";
import { listTools } from "@/lib/tools/registry";
import { ToolError } from "@/lib/tools/types";
import { rateLimit } from "@/lib/ratelimit";

/** List available tools (developer convenience). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  return Response.json({ tools: listTools() });
}

/** Execute a tool: { tool, input }. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Tools can call the embedding model (memory/knowledge search) — cap per user.
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

  try {
    const output = await executeTool(session.user.id, tool, input);
    return Response.json({ tool, output });
  } catch (err) {
    if (err instanceof ToolError) {
      const status = err.code === "unknown_tool" ? 404 : 400;
      return Response.json({ error: err.message, code: err.code }, { status });
    }
    return Response.json({ error: "Tool execution failed" }, { status: 500 });
  }
}
