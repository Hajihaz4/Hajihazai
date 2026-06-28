import "dotenv/config";
import { db } from "@/lib/db";
import { knowledgeDocument, knowledgeChunk } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

async function main() {
  const docs = await db.select().from(knowledgeDocument).where(eq(knowledgeDocument.userId, HAJI_ID));
  for (const d of docs) {
    const chunks = await db.select().from(knowledgeChunk)
      .where(eq(knowledgeChunk.documentId, d.id)).orderBy(asc(knowledgeChunk.chunkIndex));
    console.log(`\n${"=".repeat(60)}\nDOC: "${d.title}"  brain_id=${d.brainId ?? "NULL"}\n${"=".repeat(60)}`);
    for (const c of chunks) {
      console.log(`\n--- chunk ${c.chunkIndex} (${c.content.length} chars) ---\n${c.content}`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
