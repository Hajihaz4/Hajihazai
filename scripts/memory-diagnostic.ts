/**
 * Memory system diagnostic — complete evidence dump.
 * Run: npx tsx --env-file=.env.local scripts/memory-diagnostic.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { buildMemoryContext } from "@/lib/memory/context";
import { searchWithDiagnostics } from "@/lib/memory/retrieve";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

async function main() {
  /* ─── 1. Raw DB state ──────────────────────────────────────────────── */
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 2 — DATABASE EVIDENCE");
  console.log("=".repeat(60));

  const allMemories = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, HAJI_ID))
    .orderBy(desc(userMemory.updatedAt));

  const byStatus: Record<string, number> = {};
  let embeddedCount = 0;
  for (const m of allMemories) {
    byStatus[m.status] = (byStatus[m.status] ?? 0) + 1;
    const hasEmbed = Array.isArray(m.embedding) && m.embedding.length > 0;
    if (hasEmbed) embeddedCount++;
  }

  console.log(`\nTotal memories:     ${allMemories.length}`);
  console.log(`Status breakdown:   ${JSON.stringify(byStatus)}`);
  console.log(`Embedded:           ${embeddedCount} / ${allMemories.length}`);
  console.log(`NOT embedded:       ${allMemories.length - embeddedCount} / ${allMemories.length}`);

  console.log("\n--- All memories (id | status | embedded | type | content) ---");
  for (const m of allMemories) {
    const hasEmbed = Array.isArray(m.embedding) && m.embedding.length > 0;
    const preview = m.content.slice(0, 80).replace(/\n/g, " ");
    console.log(`[${m.status.padEnd(7)}] [embed:${hasEmbed ? "YES" : "NO "}} [${m.type.padEnd(10)}] ${preview}`);
  }

  /* ─── 3. Retrieval tests ───────────────────────────────────────────── */
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 3 — RETRIEVAL TESTS");
  console.log("=".repeat(60));

  const queries = [
    "What is Haji's favorite color?",
    "What is Haji's favorite food?",
    "What car does Haji like?",
    "What are Haji's goals?",
    "Tell me about Haji",
    "What business is Haji running?",
  ];

  for (const q of queries) {
    const ctx = await buildMemoryContext(HAJI_ID, { query: q });
    const found = ctx.count > 0;
    const firstLine = ctx.block.split("\n").slice(2, 3).join(""); // first bullet
    console.log(`\nQ: "${q}"`);
    console.log(`  memories returned: ${ctx.count}  fallback:${ctx.fallbackUsed}  found:${found}`);
    if (found) console.log(`  first bullet: ${firstLine}`);
    else console.log("  *** MISS — memory block is empty ***");
  }

  /* ─── 4. Prompt block inspection ──────────────────────────────────── */
  console.log("\n" + "=".repeat(60));
  console.log("PHASE 4 — PROMPT BLOCK INSPECTION");
  console.log("=".repeat(60));

  const ctx = await buildMemoryContext(HAJI_ID, { query: "Tell me about Haji" });
  console.log(`\nMemory block (what gets injected as system message):`);
  console.log(ctx.block || "  *** EMPTY — nothing injected ***");
  console.log(`\nMemory count: ${ctx.count}, fallback used: ${ctx.fallbackUsed}`);

  /* ─── Keyword-only diagnostics ─────────────────────────────────────── */
  console.log("\n" + "=".repeat(60));
  console.log("KEYWORD SEARCH DIAGNOSTICS");
  console.log("=".repeat(60));

  const diag = await searchWithDiagnostics(HAJI_ID, "favorite color");
  console.log(`\nQuery: "favorite color"`);
  console.log(`Results: ${diag.results.length}`);
  console.log(`Excluded: ${diag.excluded.length}`);
  if (diag.excluded.length > 0) {
    console.log("Excluded reasons:");
    for (const e of diag.excluded) {
      console.log(`  [${e.status}/${e.reason}] ${e.content.slice(0, 60)}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
