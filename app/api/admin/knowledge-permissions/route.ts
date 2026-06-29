import { requireAdmin } from "@/lib/admin/session";
import { listKnowledgePermissions, addKnowledgePermission } from "@/lib/admin/queries";

export async function GET(req: Request) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const search = new URL(req.url).searchParams.get("search") ?? undefined;
  const rows = await listKnowledgePermissions({ search });
  return Response.json({ permissions: rows });
}

export async function POST(req: Request) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const row = await addKnowledgePermission(email, sess.adminId);
  if (!row) return Response.json({ error: "Email already has permission" }, { status: 409 });
  return Response.json({ permission: row }, { status: 201 });
}
