/**
 * Phase B — audit chunk embedding coverage and (re)generate embeddings for every
 * chunk that is missing one. Embeddings require a reachable provider (Ollama or a
 * cloud key). DRY RUN by default (audit only). Pass --apply to generate.
 *
 * NOTE: run this in an environment where the embedding provider is reachable
 * (e.g. production runtime). It is a NO-OP for correctness if the provider is
 * down — it just reports failures; keyword retrieval keeps working regardless.
 *
 * Run: npx tsx scripts/reembed-all.mts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n")) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("="); if (i < 0) continue;
  const k = t.slice(0, i).trim(); const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}
const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL!);

async function audit(label: string) {
  const rows = await sql`
    SELECT b.slug,
      COUNT(kc.id)::int AS chunks,
      COUNT(kc.embedding)::int AS embedded
    FROM brains b
    JOIN knowledge_document kd ON kd.brain_id=b.id AND kd.status='active'
    JOIN knowledge_chunk kc ON kc."documentId"=kd.id
    GROUP BY b.slug ORDER BY chunks DESC`;
  console.log(`\n── ${label} ──`);
  let ch = 0, em = 0;
  for (const r of rows) { console.log(`  ${r.slug.padEnd(11)} ${r.embedded}/${r.chunks} embedded`); ch += r.chunks; em += r.embedded; }
  console.log(`  TOTAL      ${em}/${ch} embedded (${ch - em} missing)`);
  return { ch, em };
}

await audit("BEFORE");

if (!process.argv.includes("--apply")) {
  console.log("\nDRY RUN — no embeddings generated. Re-run with --apply where a provider is reachable.");
  process.exit(0);
}

// Generate embeddings per document that has any unembedded chunk.
const { embedDocumentChunks } = await import("../lib/knowledge/embed-chunks.ts");
const docs = await sql`
  SELECT DISTINCT kd.id, kd."userId" AS uid, kd.title
  FROM knowledge_document kd JOIN knowledge_chunk kc ON kc."documentId"=kd.id
  WHERE kd.status='active' AND kc.embedding IS NULL`;
console.log(`\nDocuments with missing embeddings: ${docs.length}`);
let ok = 0;
for (const d of docs) {
  try { await embedDocumentChunks(d.uid, d.id); ok++; console.log(`  ✅ ${d.title}`); }
  catch (e) { console.error(`  ❌ ${d.title}: ${(e as Error).message.slice(0, 80)}`); }
}
console.log(`\nEmbedded ${ok}/${docs.length} documents.`);
await audit("AFTER");
