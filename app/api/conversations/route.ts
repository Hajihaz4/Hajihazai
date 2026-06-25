import { auth } from "@/auth";
import { createConversation, listConversations } from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rows = await listConversations(session.user.id);
  return Response.json({
    conversations: rows.map((c) => ({ id: c.id, title: c.title })),
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const convo = await createConversation(session.user.id);
  return Response.json({ id: convo.id, title: convo.title });
}
