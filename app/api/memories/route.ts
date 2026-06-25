import { auth } from "@/auth";
import { createMemory, listMemories } from "@/lib/db/memory-queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rows = await listMemories(session.user.id);
  return Response.json({ memories: rows });
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
