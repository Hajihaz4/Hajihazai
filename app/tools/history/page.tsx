import { auth } from "@/auth";
import {
  countToolInvocations,
  listToolInvocations,
} from "@/lib/db/tool-queries";

const PAGE_SIZE = 20;

const STATUS_STYLE: Record<string, string> = {
  success: "bg-green-600/10 text-green-600",
  error: "bg-destructive/10 text-destructive",
  timeout: "bg-amber-500/15 text-amber-600",
};

export default async function ToolHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">
          Please sign in to view tool history.
        </p>
      </main>
    );
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, total] = await Promise.all([
    listToolInvocations(session.user.id, { limit: PAGE_SIZE, offset }),
    countToolInvocations(session.user.id),
  ]);
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        Tool History
      </h1>

      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No tool invocations yet.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.toolName}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      STATUS_STYLE[r.status] ?? "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                  <span>{r.durationMs} ms</span>
                  <span>
                    in {r.inputSize}B · out {r.outputSize}B
                  </span>
                  <span>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <a
                  href={`/tools/history?page=${page - 1}`}
                  className="rounded-lg border px-3 py-1.5 hover:bg-accent"
                >
                  Previous
                </a>
              ) : null}
              {page < totalPages ? (
                <a
                  href={`/tools/history?page=${page + 1}`}
                  className="rounded-lg border px-3 py-1.5 hover:bg-accent"
                >
                  Next
                </a>
              ) : null}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
