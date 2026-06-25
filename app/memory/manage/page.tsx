import { auth } from "@/auth";
import { listAllMemories, memoryStats } from "@/lib/db/memory-queries";
import MemoryManager from "@/components/memory-manager";

export default async function MemoryManagePage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to manage your memory.
        </p>
      </main>
    );
  }

  const rows = await listAllMemories(session.user.id);
  const stats = await memoryStats(session.user.id);
  const memories = rows.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    status: m.status,
  }));

  return <MemoryManager initialMemories={memories} initialStats={stats} />;
}
