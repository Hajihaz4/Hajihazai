import { auth } from "@/auth";
import { forgetAllMemories } from "@/lib/db/memory-queries";

/**
 * Delete EVERY memory for the current user.
 * Requires explicit confirmation in the body: { confirm: true }.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body?.confirm !== true) {
    return new Response("confirmation required", { status: 400 });
  }

  const deleted = await forgetAllMemories(session.user.id);
  return Response.json({ deleted: deleted.length });
}
