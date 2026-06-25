import { auth } from "@/auth";
import { searchMemories, searchWithDiagnostics } from "@/lib/memory/retrieve";

type MemoryRow = {
  id: string;
  type: string;
  content: string;
  status: string;
  score: number;
  updatedAt: Date | string;
};

function serialize(m: MemoryRow) {
  return {
    id: m.id,
    type: m.type,
    content: m.content,
    status: m.status,
    score: m.score,
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
  };
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const debug = url.searchParams.get("debug");

  if (debug === "1" || debug === "true") {
    const data = await searchWithDiagnostics(session.user.id, q);
    return Response.json({
      query: data.query,
      results: data.results.map(serialize),
      excluded: data.excluded,
    });
  }

  const results = await searchMemories(session.user.id, q);
  return Response.json({ query: q, results: results.map(serialize) });
}
