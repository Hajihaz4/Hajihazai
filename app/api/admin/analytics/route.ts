import { requireAdmin } from "@/lib/admin/session";
import { getAdminAnalyticsV2 } from "@/lib/admin/queries";

export async function GET() {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const analytics = await getAdminAnalyticsV2();
  return Response.json({ analytics });
}
