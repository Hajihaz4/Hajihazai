import { auth } from "@/auth";
import ToolsDebug from "@/components/tools-debug";

export default async function ToolsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">Please sign in to use the tools.</p>
      </main>
    );
  }

  return <ToolsDebug />;
}
