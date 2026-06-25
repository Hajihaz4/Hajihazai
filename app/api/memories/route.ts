import { auth } from "@/auth";
import {
  createMemory,
  listMemories,
  listAllMemories,
  memoryStats,
} from "@/lib/db/memory-queries";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const status = new URL(req.url).searchParams.get("status") ?? "visible";

  let memories;
  if (status === "all") {
    memories = await listAllMemories(session.user.id);
  } else if (status === "active" || status === "pending" || status === "deleted") {
    const all = await listAllMemories(session.user.id);
    memories = all.filter((m) => m.status === status);
  } else {
    // default "visible" = active + pending (unchanged behavior)
    memories = await listMemories(session.user.id);
  }

  const stats = await memoryStats(session.user.id);
  return Response.json({ memories, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const content = body?.content;
  const type = body?.type;
  if (typeof content !== "string" || !content.trim()) {
    return new Response("content is required", { status: 400 });
  }

  const memory = await createMemory(session.user.id, {
    content: content.trim(),
    type: typeof type === "string" && type.trim() ? type.trim() : undefined,
  });
  return Response.json({ memory }, { status: 201 });
}
