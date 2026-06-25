import { auth } from "@/auth";
import { listDocuments } from "@/lib/db/knowledge-queries";
import KnowledgeBase from "@/components/knowledge-base";

export default async function KnowledgePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to view your knowledge base.
        </p>
      </main>
    );
  }

  const rows = await listDocuments(session.user.id);
  const documents = rows.map((d) => ({
    id: d.id,
    title: d.title,
    sourceType: d.sourceType,
    status: d.status,
  }));

  return <KnowledgeBase initialDocuments={documents} />;
}
