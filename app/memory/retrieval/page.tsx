import { auth } from "@/auth";
import RetrievalDebug from "@/components/retrieval-debug";

export default async function MemoryRetrievalPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to use retrieval debug.
        </p>
      </main>
    );
  }

  return <RetrievalDebug />;
}
