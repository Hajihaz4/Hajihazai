/**
 * Diagnostic — run once to show full knowledge state for Haji's user.
 * NOT a vitest test — run directly with tsx.
 */
import { db } from "@/lib/db";
import { knowledgeDocument, knowledgeChunk } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildKnowledgeContext } from "@/lib/memory/context";
import { projectScope } from "@/lib/knowledge/scope";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

console.log("=== DOCUMENTS ===");
const docs = await db
  .select()
  .from(knowledgeDocument)
  .where(eq(knowledgeDocument.userId, HAJI_ID));

for (const d of docs) {
  const chunks = await db
    .select()
    .from(knowledgeChunk)
    .where(eq(knowledgeChunk.documentId, d.id))
    .orderBy(asc(knowledgeChunk.chunkIndex));

  console.log(`\n[${d.id}] "${d.title}"`);
  console.log(`  category:  ${d.category ?? "null"}`);
  console.log(`  projectId: ${d.projectId ?? "null (user-level)"}`);
  console.log(`  status:    ${d.status}`);
  console.log(`  chunks:    ${chunks.length}`);
  for (const c of chunks) {
    const hasEmbed = !!(c as { embedding?: unknown }).embedding;
    console.log(`    chunk[${c.chunkIndex}] id=${c.id} embed=${hasEmbed}`);
    console.log(`      "${c.content.slice(0, 120).replace(/\n/g, " ")}..."`);
  }
}

console.log("\n=== SCOPE TEST: projectScope(null) ===");
console.log("  (simulates loose chat — what does scope match?)");
console.log(" ", projectScope(null)?.queryChunks.text ?? "SQL: IS NULL");

console.log("\n=== RETRIEVAL TRACE ===");

const queries = [
  { q: "What is Haji's goal?",                projectId: null as null,   label: "loose chat" },
  { q: "What is Haji's goal?",                projectId: "fake-proj-id", label: "project chat" },
  { q: "Does Haji have a girlfriend?",        projectId: null as null,   label: "loose chat" },
  { q: "What do you know about Haji?",        projectId: null as null,   label: "loose chat" },
  { q: "When was Haji born?",                 projectId: null as null,   label: "loose chat" },
];

for (const { q, projectId, label } of queries) {
  console.log(`\n  Q: "${q}" [${label}]`);
  const k = await buildKnowledgeContext(HAJI_ID, { query: q, projectId });
  console.log(`    hits: ${k.count}  block_len: ${k.block.length}`);
  if (k.chunks.length > 0) {
    for (const c of k.chunks) {
      console.log(`    chunk: "${c.content.slice(0, 100).replace(/\n/g, " ")}..." (score: ${c.similarity.toFixed(3)})`);
    }
  } else {
    console.log("    NO CHUNKS RETRIEVED");
  }
  if (k.block) {
    console.log(`    block preview: "${k.block.slice(0, 200).replace(/\n/g, " ")}..."`);
  }
}

process.exit(0);
