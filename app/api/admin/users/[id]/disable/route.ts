import { requireAdmin } from "@/lib/admin/session";
import { adminSetUserDisabled, adminGetUserDetail } from "@/lib/admin/queries";
import { syncEventToSheets } from "@/lib/google-sheets";

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

  const user = await adminGetUserDetail(id).catch(() => null);
  if (user?.email) {
    syncEventToSheets({ email: user.email, eventType: disabled ? "account_disabled" : "account_enabled", detail: `by admin ${sess.adminId}` });
  }

  return Response.json({ ok: true, disabled });
}
