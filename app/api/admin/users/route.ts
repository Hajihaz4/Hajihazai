import { requireAdmin } from "@/lib/admin/session";
import { adminListUsersPage } from "@/lib/admin/queries";

export async function GET(req: Request) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));

  const result = await adminListUsersPage({ search, page, limit });
  return Response.json(result);
}
