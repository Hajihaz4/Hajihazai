import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground">
        <Sparkles className="size-4" />
        <span>MVP — Phase 1</span>
      </div>

      <h1 className="mt-8 text-5xl font-semibold tracking-tight sm:text-6xl">
        HajiHaz AI
      </h1>

      <p className="mt-4 max-w-xl text-balance text-lg text-muted-foreground">
        A next-generation AI assistant powered by memory, retrieval, and
        multi-model intelligence.
      </p>

      <div className="mt-10 inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
        Chat is coming online soon
      </div>

      <footer className="mt-16 text-xs text-muted-foreground">
        hajihazai.com
      </footer>
    </main>
  );
}
