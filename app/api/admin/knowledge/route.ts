import { requireAdmin } from "@/lib/admin/session";
import { adminListKnowledge } from "@/lib/admin/queries";
import { ingestText } from "@/lib/knowledge/ingest";

export async function GET() {
  await requireAdmin();
  const knowledge = await adminListKnowledge();
  return Response.json({ knowledge });
}

export async function POST(req: Request) {
  await requireAdmin();

  const { userId, projectId, title, category, content } = await req.json();

  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }
  if (!title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }
  if (!content?.trim()) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  const result = await ingestText(userId, {
    title: title.trim(),
    content: content.trim(),
    projectId: projectId || null,
    category: category || null,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 422 });
  }

  return Response.json({ ok: true, documentId: result.documentId, chunks: result.chunks });
}
