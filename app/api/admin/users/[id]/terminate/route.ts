import { requireAdmin } from "@/lib/admin/session";
import { adminGetUserDetail, adminTerminateUser } from "@/lib/admin/queries";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const user = await adminGetUserDetail(id);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  if (!user.email) return Response.json({ error: "User has no email" }, { status: 400 });

  await adminTerminateUser(id, user.email);
  return Response.json({ ok: true });
}
