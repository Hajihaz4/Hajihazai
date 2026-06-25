import { Github, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { listConversations } from "@/lib/db/queries";
import { signInWithGitHub } from "@/app/actions";
import ChatApp from "@/components/chat-app";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-4" /> HajiHaz AI
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Welcome to HajiHaz AI
        </h1>
        <p className="max-w-md text-muted-foreground">
          Sign in to start chatting. Your conversations are saved and ready
          whenever you return.
        </p>
        <form action={signInWithGitHub}>
          <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <Github className="size-4" /> Continue with GitHub
          </button>
        </form>
      </main>
    );
  }

  const rows = await listConversations(session.user.id);
  const conversations = rows.map((c) => ({ id: c.id, title: c.title }));

  return (
    <ChatApp
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      initialConversations={conversations}
    />
  );
}
