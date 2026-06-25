import { auth } from "@/auth";
import {
  createContent,
  deleteContent,
  getContent,
  updateContent,
} from "@/lib/db/knowledge-content-queries";
import { getDocument } from "@/lib/db/knowledge-queries";

async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  // Distinguish "document not owned/missing" (404) from "no content yet".
  if (!(await getDocument(userId, id))) {
    return new Response("Not found", { status: 404 });
  }
  const content = await getContent(userId, id);
  return Response.json({ content });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (typeof body?.content !== "string") {
    return new Response("content is required", { status: 400 });
  }

  const content = await createContent(userId, id, body.content);
  if (!content) return new Response("Not found", { status: 404 });
  return Response.json({ content }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (typeof body?.content !== "string") {
    return new Response("content is required", { status: 400 });
  }

  const content = await updateContent(userId, id, body.content);
  if (!content) return new Response("Not found", { status: 404 });
  return Response.json({ content });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await requireUser();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const deleted = await deleteContent(userId, id);
  if (!deleted) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
