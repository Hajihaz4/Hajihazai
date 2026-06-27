import { requireAdmin } from "@/lib/admin/session";
import { adminListProjectsForPicker } from "@/lib/admin/queries";

/** Minimal project list for UI dropdowns (id, name, userId only). */
export async function GET() {
  await requireAdmin();
  const projects = await adminListProjectsForPicker();
  return Response.json({ projects });
}
