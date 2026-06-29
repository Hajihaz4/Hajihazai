import { requireAdmin } from "@/lib/admin/session";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

async function checkProvider(name: string, url: string, apiKey: string | undefined): Promise<{
  provider: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  if (!apiKey) return { provider: name, ok: false, latencyMs: 0, error: "No API key configured" };
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { provider: name, ok: res.ok || res.status === 401, latencyMs: Date.now() - start };
  } catch (err) {
    return { provider: name, ok: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

export async function GET() {
  const sess = await requireAdmin();
  if (!sess) return new Response("Unauthorized", { status: 401 });

  const [database, ...providers] = await Promise.all([
    checkDatabase(),
    checkProvider("OpenAI", "https://api.openai.com/v1/models", process.env.OPENAI_API_KEY),
    checkProvider("Anthropic", "https://api.anthropic.com/v1/models", process.env.ANTHROPIC_API_KEY),
    checkProvider("Google Gemini", "https://generativelanguage.googleapis.com/v1beta/models", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
  ]);

  const memUsage = process.memoryUsage();

  return Response.json({
    status: database.ok ? "healthy" : "degraded",
    checkedAt: new Date().toISOString(),
    database,
    providers,
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    uptime: Math.round(process.uptime()),
  });
}
