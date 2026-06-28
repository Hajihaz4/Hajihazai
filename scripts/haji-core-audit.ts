/**
 * Haji Core knowledge audit — shows every document assigned to Haji Core brain,
 * dumps all chunk text, then simulates the 6 family queries to show retrieval hits.
 * Run: npx tsx scripts/haji-core-audit.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import {
  knowledgeDocument,
  knowledgeChunk,
  brains,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildKnowledgeContext } from "@/lib/memory/context";
import { getBrainBySlug } from "@/lib/db/brain-queries";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

async function main() {
  const hajiCore = await getBrainBySlug("haji-core");
  const hajiCoreId = hajiCore?.id ?? null;

  console.log("\n=== HAJI CORE BRAIN ===");
  console.log(`brain_id: ${hajiCoreId}`);

  // All docs for this user — show brain assignment
  const docs = await db
    .select()
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.userId, HAJI_ID));

  console.log(`\nTotal knowledge documents for Haji: ${docs.length}`);

  for (const d of docs) {
    const chunks = await db
      .select()
      .from(knowledgeChunk)
      .where(eq(knowledgeChunk.documentId, d.id))
      .orderBy(knowledgeChunk.chunkIndex);

    const isHajiCore = d.brainId === hajiCoreId;
    const label = isHajiCore ? "[HAJI CORE]" : d.brainId ? `[brain:${d.brainId}]` : "[NO BRAIN]";

    console.log(`\n${label} "${d.title}"`);
    console.log(`  id:       ${d.id}`);
    console.log(`  category: ${d.category ?? "null"}`);
    console.log(`  status:   ${d.status}`);
    console.log(`  chunks:   ${chunks.length}`);

    for (const c of chunks) {
      const preview = c.content.replace(/\n/g, " ").slice(0, 200);
      console.log(`  [chunk ${c.chunkIndex}] len=${c.content.length} : ${preview}`);
    }
  }

  // Family query simulation
  const queries = [
    "Who is Safina Thangam?",
    "Who is Hamza?",
    "Who is Sahabuddin?",
    "Who is Hidhayaa?",
    "Who is Haji's mother's sister?",
    "List Haji family tree",
  ];

  console.log("\n=== FAMILY QUERY SIMULATION (brainId=haji-core) ===");
  for (const q of queries) {
    const ctx = await buildKnowledgeContext(HAJI_ID, {
      query: q,
      brainId: hajiCoreId,
    });
    const hit = ctx.count > 0;
    const preview = ctx.block.replace(/\n/g, " ").slice(0, 300);
    console.log(`\nQ: "${q}"`);
    console.log(`  chunks returned: ${ctx.count}  |  hit=${hit}`);
    if (hit) console.log(`  snippet: ${preview}`);
    else console.log("  *** MISS — no relevant chunks found ***");
  }

  // Also check raw family keyword presence in ALL chunk text
  const allChunks = await db
    .select({ content: knowledgeChunk.content, docId: knowledgeChunk.documentId })
    .from(knowledgeChunk)
    .innerJoin(knowledgeDocument, eq(knowledgeChunk.documentId, knowledgeDocument.id))
    .where(eq(knowledgeDocument.userId, HAJI_ID));

  const familyKeywords = ["safina", "hamza", "sahabuddin", "hidhayaa", "family", "mother", "father", "sister", "brother"];
  console.log("\n=== RAW KEYWORD PRESENCE IN ALL CHUNKS ===");
  for (const kw of familyKeywords) {
    const hits = allChunks.filter((c) => c.content.toLowerCase().includes(kw));
    console.log(`"${kw}": ${hits.length} chunk(s) ${hits.length ? "" : "*** NOT FOUND ***"}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
