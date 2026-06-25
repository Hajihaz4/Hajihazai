import { auth } from "@/auth";
import { memoryEmbeddingStatus } from "@/lib/memory/embed-memory";
import EmbeddingDebug from "@/components/embedding-debug";

export default async function MemoryEmbeddingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to view memory embeddings.
        </p>
      </main>
    );
  }

  const rows = await memoryEmbeddingStatus(session.user.id);
  return <EmbeddingDebug initialRows={rows} />;
}
