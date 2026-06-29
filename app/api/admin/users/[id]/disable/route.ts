import { requireAdmin } from "@/lib/admin/session";
import { adminSetUserDisabled } from "@/lib/admin/queries";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const disabled: boolean = body.disabled !== false;

  const ok = await adminSetUserDisabled(id, disabled);
  if (!ok) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json({ ok: true, disabled });
}
