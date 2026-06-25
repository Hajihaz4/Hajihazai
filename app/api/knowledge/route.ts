import { auth } from "@/auth";
import { createDocument, listDocuments } from "@/lib/db/knowledge-queries";

const SOURCE_TYPES = ["pdf", "text", "website", "note"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const documents = await listDocuments(session.user.id);
  return Response.json({ documents });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = body?.title;
  const sourceType = body?.sourceType;
  if (typeof title !== "string" || !title.trim()) {
    return new Response("title is required", { status: 400 });
  }
  if (sourceType !== undefined && !SOURCE_TYPES.includes(sourceType)) {
    return new Response("invalid sourceType", { status: 400 });
  }

  const document = await createDocument(session.user.id, {
    title: title.trim(),
    sourceType,
  });
  return Response.json({ document }, { status: 201 });
}
