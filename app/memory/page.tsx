import { auth } from "@/auth";
import { listMemories } from "@/lib/db/memory-queries";
import MemoryViewer from "@/components/memory-viewer";

export default async function MemoryPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">Please sign in to view your memory.</p>
      </main>
    );
  }

  const rows = await listMemories(session.user.id);
  const memories = rows.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    status: m.status,
    updatedAt: m.updatedAt.toISOString(),
  }));

  return <MemoryViewer initialMemories={memories} />;
}
