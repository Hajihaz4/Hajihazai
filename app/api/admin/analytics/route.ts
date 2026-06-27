import { requireAdmin } from "@/lib/admin/session";
import { getAdminAnalytics } from "@/lib/admin/queries";

export async function GET() {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const analytics = await getAdminAnalytics();
  return Response.json({ analytics });
}
