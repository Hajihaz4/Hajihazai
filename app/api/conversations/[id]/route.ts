import { auth } from "@/auth";
import { deleteConversation } from "@/lib/db/queries";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  await deleteConversation(session.user.id, id);
  return new Response(null, { status: 204 });
}
