import { requireAdmin } from "@/lib/admin/session";
import { adminSuspendUser, adminRestoreUser } from "@/lib/admin/queries";

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
  } else {
    await adminRestoreUser(id);
  }

  return Response.json({ ok: true, suspended: suspend });
}
