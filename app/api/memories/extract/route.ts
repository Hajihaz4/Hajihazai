import { auth } from "@/auth";
import { listConversations } from "@/lib/db/queries";
import { extractMemories } from "@/lib/memory/extract";

/**
 * Manual extraction trigger.
 * Body: { conversationId? } — defaults to the user's most recent conversation.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  let conversationId = body?.conversationId;

  if (typeof conversationId !== "string") {
    const convos = await listConversations(session.user.id);
    if (convos.length === 0) {
      return new Response("No conversation to extract from", { status: 400 });
    }
    conversationId = convos[0].id;
  }

  const result = await extractMemories(session.user.id, conversationId);
  if (result.reason === "not_found") {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({
    conversationId: result.conversationId,
    created: result.created,
    count: result.created.length,
  });
}
