import { auth } from "@/auth";
import {
  bulkApprove,
  bulkDelete,
  bulkReject,
} from "@/lib/db/memory-queries";

/**
 * Bulk actions on the user's own memories.
 * Body: { action: "approve" | "reject" | "delete", ids: string[] }
 * Ownership is enforced in every query (userId scope).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const ids = body?.ids;

  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return new Response("ids must be an array of strings", { status: 400 });
  }
  if (!["approve", "reject", "delete"].includes(action)) {
    return new Response("invalid action", { status: 400 });
  }

  let affected;
  if (action === "approve") affected = await bulkApprove(session.user.id, ids);
  else if (action === "reject") affected = await bulkReject(session.user.id, ids);
  else affected = await bulkDelete(session.user.id, ids);

  return Response.json({
    action,
    affected: affected.length,
    ids: affected.map((a) => a.id),
  });
}
