import { destroyAdminSession } from "@/lib/admin/session";

export async function POST() {
  await destroyAdminSession();
  return Response.json({ ok: true });
}
