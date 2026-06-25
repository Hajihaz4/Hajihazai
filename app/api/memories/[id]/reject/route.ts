import { auth } from "@/auth";
import { rejectMemory } from "@/lib/db/memory-queries";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await params;

  // Null → not found, not owned, or not currently pending.
  const memory = await rejectMemory(session.user.id, id);
  if (!memory) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json({ memory });
}
