import { auth } from "@/auth";
import {
  createContent,
  deleteContent,
  getContent,
  updateContent,
} from "@/lib/db/knowledge-content-queries";
import { getDocument } from "@/lib/db/knowledge-queries";
import { assertKnowledgeWritePermission } from "@/lib/knowledge/permissions";
import { validateKnowledgeContent, logKnowledgeAction } from "@/lib/knowledge/safety";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { userId: session.user.id, email: session.user.email ?? "" };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  if (!(await getDocument(user.userId, id))) {
    return new Response("Not found", { status: 404 });
  }
  const content = await getContent(user.userId, id);
  return Response.json({ content });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const perm = await assertKnowledgeWritePermission(user.email);
  if (!perm.ok) return Response.json({ error: perm.error }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.content !== "string") {
    return new Response("content is required", { status: 400 });
  }

  const safety = validateKnowledgeContent(body.content);
  if (!safety.ok) return Response.json({ error: safety.error }, { status: 422 });

  const doc = await getDocument(user.userId, id);
  if (!doc) return new Response("Not found", { status: 404 });

  const content = await createContent(user.userId, id, body.content);
  if (!content) return new Response("Not found", { status: 404 });

  void logKnowledgeAction({
    userId: user.userId,
    email: user.email,
    action: "create_content",
    documentId: id,
    documentTitle: doc.title,
    contentAfter: body.content,
  });

  return Response.json({ content }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const perm = await assertKnowledgeWritePermission(user.email);
  if (!perm.ok) return Response.json({ error: perm.error }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.content !== "string") {
    return new Response("content is required", { status: 400 });
  }

  const safety = validateKnowledgeContent(body.content);
  if (!safety.ok) return Response.json({ error: safety.error }, { status: 422 });

  const doc = await getDocument(user.userId, id);
  if (!doc) return new Response("Not found", { status: 404 });

  const existing = await getContent(user.userId, id);
  const content = await updateContent(user.userId, id, body.content);
  if (!content) return new Response("Not found", { status: 404 });

  void logKnowledgeAction({
    userId: user.userId,
    email: user.email,
    action: "update_content",
    documentId: id,
    documentTitle: doc.title,
    contentBefore: existing?.content ?? undefined,
    contentAfter: body.content,
  });

  return Response.json({ content });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const perm = await assertKnowledgeWritePermission(user.email);
  if (!perm.ok) return Response.json({ error: perm.error }, { status: 403 });

  const { id } = await params;
  const doc = await getDocument(user.userId, id);
  const deleted = await deleteContent(user.userId, id);
  if (!deleted) return new Response("Not found", { status: 404 });

  void logKnowledgeAction({
    userId: user.userId,
    email: user.email,
    action: "delete_content",
    documentId: id,
    documentTitle: doc?.title ?? id,
  });

  return new Response(null, { status: 204 });
}
