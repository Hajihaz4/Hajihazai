import { auth } from "@/auth";
import ExtractionDebug from "@/components/extraction-debug";

export default async function MemoryDebugPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to use the extraction debugger.
        </p>
      </main>
    );
  }

  return <ExtractionDebug />;
}
