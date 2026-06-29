import { requireAdmin } from "@/lib/admin/session";
import { adminSuspendUser, adminRestoreUser, adminRevokeUserSessions } from "@/lib/admin/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const suspend = body.suspend !== false;

  if (suspend) {
    await adminSuspendUser(id);
    // Revoke active sessions so the effect is immediate
    void adminRevokeUserSessions(id).catch(() => null);
  } else {
    await adminRestoreUser(id);
  }

  return Response.json({ ok: true, suspended: suspend });
}
