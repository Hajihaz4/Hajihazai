import { auth } from "@/auth";
import { deleteDocument, getDocument } from "@/lib/db/knowledge-queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  const document = await getDocument(session.user.id, id);
  if (!document) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ document });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  const deleted = await deleteDocument(session.user.id, id);
  if (!deleted) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(null, { status: 204 });
}
