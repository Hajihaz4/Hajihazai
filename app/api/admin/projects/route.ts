import { requireAdmin } from "@/lib/admin/session";
import { adminListProjectsForPicker } from "@/lib/admin/queries";

/** Minimal project list for UI dropdowns (id, name, userId only). */
export async function GET() {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });
  const projects = await adminListProjectsForPicker();
  return Response.json({ projects });
}
