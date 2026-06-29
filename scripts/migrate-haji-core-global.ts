/**
 * Verifies and applies the global visibility migration for Haji Core documents.
 *
 * Run AFTER applying migration 0016_global_knowledge.sql:
 *   npx tsx --env-file=.env.local scripts/migrate-haji-core-global.ts
 *
 * The SQL migration already runs the UPDATE — this script just verifies it
 * worked and reports any docs that still need marking.
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { knowledgeDocument, brains } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const HAJI_CORE_SLUG = "haji-core";

async function main() {
  // 1. Find the haji-core brain ID.
  const [brain] = await db
    .select({ id: brains.id, name: brains.name })
    .from(brains)
    .where(eq(brains.slug, HAJI_CORE_SLUG));

  if (!brain) {
    console.error(`Brain with slug "${HAJI_CORE_SLUG}" not found. Aborting.`);
    process.exit(1);
  }

  console.log(`Haji Core brain: ${brain.id} (${brain.name})\n`);

  // 2. Count all docs in this brain.
  const allDocs = await db
    .select({ id: knowledgeDocument.id, title: knowledgeDocument.title, visibility: knowledgeDocument.visibility })
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.brainId, brain.id));

  console.log(`Total Haji Core documents: ${allDocs.length}`);

  const globalDocs = allDocs.filter((d) => d.visibility === "global");
  const privateDocs = allDocs.filter((d) => d.visibility === "private");

  console.log(`  Already global: ${globalDocs.length}`);
  console.log(`  Still private:  ${privateDocs.length}`);

  if (globalDocs.length > 0) {
    console.log("\nGlobal documents:");
    for (const d of globalDocs) {
      console.log(`  ✓ ${d.title}`);
    }
  }

  // 3. If any are still private, fix them now.
  if (privateDocs.length > 0) {
    console.log("\nFixing private docs…");
    for (const d of privateDocs) {
      await db
        .update(knowledgeDocument)
        .set({ visibility: "global" })
        .where(and(eq(knowledgeDocument.id, d.id), eq(knowledgeDocument.brainId, brain.id)));
      console.log(`  ✓ ${d.title} → global`);
    }
    console.log(`\nFixed ${privateDocs.length} documents.`);
  } else {
    console.log("\n✓ All Haji Core documents are already global. No action needed.");
  }

  // 4. Summary.
  const after = await db
    .select({ visibility: knowledgeDocument.visibility })
    .from(knowledgeDocument)
    .where(eq(knowledgeDocument.brainId, brain.id));

  const ok = after.every((d) => d.visibility === "global");
  console.log(`\nFinal state: ${after.length} documents, all global: ${ok ? "✓ YES" : "✗ NO"}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
