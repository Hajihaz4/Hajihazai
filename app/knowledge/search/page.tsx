import { auth } from "@/auth";
import KnowledgeSearchDebug from "@/components/knowledge-search-debug";

export default async function KnowledgeSearchPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to search your knowledge base.
        </p>
      </main>
    );
  }

  return <KnowledgeSearchDebug />;
}
