import { auth } from "@/auth";
import SemanticDebug from "@/components/semantic-debug";

export default async function MemorySemanticPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to use semantic search.
        </p>
      </main>
    );
  }

  return <SemanticDebug />;
}
