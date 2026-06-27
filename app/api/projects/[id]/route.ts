import { auth } from "@/auth";
import { updateProject, deleteProject } from "@/lib/db/project-queries";

const NAME_MAX = 100;
const TEXT_MAX = 4000;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const patch: { name?: string; description?: string | null; instructions?: string | null } = {};
  if (typeof body?.name === "string") {
    const n = body.name.trim();
    if (!n) return Response.json({ error: "Name is required" }, { status: 400 });
    patch.name = n.slice(0, NAME_MAX);
  }
  if (typeof body?.description === "string") patch.description = body.description.slice(0, TEXT_MAX);
  if (typeof body?.instructions === "string") patch.instructions = body.instructions.slice(0, TEXT_MAX);

  const updated = await updateProject(session.user.id, id, patch);
  if (!updated) return new Response("Not found", { status: 404 });
  return Response.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const ok = await deleteProject(session.user.id, id);
  if (!ok) return new Response("Not found", { status: 404 });
  return new Response(null, { status: 204 });
}
