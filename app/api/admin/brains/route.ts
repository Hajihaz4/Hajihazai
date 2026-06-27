import { requireAdmin } from "@/lib/admin/session";
import {
  listBrains,
  createBrain,
  getBrainStats,
  listBrainsForPicker,
} from "@/lib/db/brain-queries";

export async function GET(req: Request) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const view = url.searchParams.get("view");

  if (view === "stats") {
    const stats = await getBrainStats();
    return Response.json({ brains: stats });
  }
  if (view === "picker") {
    const brains = await listBrainsForPicker();
    return Response.json({ brains });
  }

  const brains = await listBrains();
  return Response.json({ brains });
}

export async function POST(req: Request) {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const { name, slug, description, icon, color, isSystem } = await req.json();
  if (!name?.trim() || !slug?.trim()) {
    return Response.json({ error: "name and slug are required" }, { status: 422 });
  }

  try {
    const brain = await createBrain({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
      description: description?.trim() || null,
      icon: icon || "🧠",
      color: color || "#6366f1",
      isSystem: isSystem === true,
    });
    return Response.json({ brain }, { status: 201 });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return Response.json({ error: "Slug already in use" }, { status: 409 });
    }
    throw err;
  }
}
