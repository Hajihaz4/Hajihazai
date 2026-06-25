import { auth } from "@/auth";
import { listAllMemories } from "@/lib/db/memory-queries";

/** Export ALL of the current user's memories as a downloadable JSON file. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const memories = await listAllMemories(session.user.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    userId: session.user.id,
    count: memories.length,
    memories,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="hajihaz-memories.json"',
    },
  });
}
