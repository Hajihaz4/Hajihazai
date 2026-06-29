import { requireAdmin } from "@/lib/admin/session";
import { adminGetUserDetail, adminDeleteUser } from "@/lib/admin/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const user = await adminGetUserDetail(id);
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const ok = await adminDeleteUser(id);
  if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
