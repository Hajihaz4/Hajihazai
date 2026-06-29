/**
 * Deeper DB check — look at all memories across all users.
 * Run: npx tsx --env-file=.env.local scripts/memory-db-check.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { userMemory, users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { createMemory } from "@/lib/db/memory-queries";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

async function main() {
  // 1. Total memories across all users
  const [total] = await db.select({ count: sql<number>`count(*)` }).from(userMemory);
  console.log(`Total memories in DB (all users): ${total.count}`);

  // 2. Per-user count
  const perUser = await db
    .select({ userId: userMemory.userId, count: sql<number>`count(*)` })
    .from(userMemory)
    .groupBy(userMemory.userId);
  console.log(`Users with memories: ${perUser.length}`);
  for (const row of perUser) {
    console.log(`  userId=${row.userId} count=${row.count}`);
  }

  // 3. Test: create a memory directly and read it back
  console.log("\n--- Testing memory creation ---");
  const created = await createMemory(HAJI_ID, {
    content: "Haji's favorite color is white.",
    type: "preference",
    status: "active",
  });
  console.log(`Created memory: id=${created.id} status=${created.status}`);

  // 4. Read it back
  const [verify] = await db
    .select()
    .from(userMemory)
    .where(sql`id = ${created.id}`);
  console.log(`Verified from DB: id=${verify?.id} content=${verify?.content.slice(0, 60)}`);

  // 5. Check embedding column
  const hasEmbed = Array.isArray(verify?.embedding) && (verify?.embedding?.length ?? 0) > 0;
  console.log(`Embedding populated: ${hasEmbed}`);

  // 6. Clean up
  await db.delete(userMemory).where(sql`id = ${created.id}`);
  console.log(`Cleaned up test memory.`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
