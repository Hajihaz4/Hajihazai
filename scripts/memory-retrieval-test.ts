/**
 * Verifies keyword fallback retrieval with the seeded memories.
 * Tests both the fallback path and the final prompt block shape.
 * Run: npx tsx --env-file=.env.local scripts/memory-retrieval-test.ts
 */
import "dotenv/config";
import { getActiveMemories } from "@/lib/memory/retrieve";
import { rankMemories } from "@/lib/memory/ranking";
import { buildMemoryBlock } from "@/lib/memory/context-format";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";
const MEMORY_MAX_CHARS = 3000;
const DEFAULT_BUDGET_TOKENS = 800;

const TESTS = [
  { query: "What is Haji's favorite color?", expect: "white" },
  { query: "What is Haji's favorite food?", expect: "biryani" },
  { query: "Who is Haji?", expect: "syed hasan" },
  { query: "Tell me about Haji's family", expect: "shehnaz" },
  { query: "Who is Safina Thangam?", expect: "safina" },
  { query: "Who is Sahabuddin?", expect: "sahabuddin" },
  { query: "What are Haji's goals?", expect: "goal" },
  { query: "What business does Haji run?", expect: "suplaykart" },
];

async function main() {
  const active = await getActiveMemories(HAJI_ID);
  console.log(`Active memories loaded: ${active.length}\n`);

  let passed = 0;
  let failed = 0;

  for (const t of TESTS) {
    // Simulate the fixed fallback: try keyword match, fall back to all if no match.
    let ranked = rankMemories(active, t.query, Date.now());
    if (ranked.length === 0) ranked = rankMemories(active, undefined, Date.now());

    const { block, count } = buildMemoryBlock(ranked, DEFAULT_BUDGET_TOKENS, MEMORY_MAX_CHARS);
    const found = block.toLowerCase().includes(t.expect.toLowerCase());

    if (found) {
      console.log(`✓  "${t.query}"`);
      console.log(`   → matched "${t.expect}" in ${count} memories`);
      passed++;
    } else {
      console.log(`✗  "${t.query}"`);
      console.log(`   → MISS — expected "${t.expect}" not found in block (${count} memories returned)`);
      failed++;
      if (count === 0) {
        const all = rankMemories(active, undefined, Date.now());
        const { block: allBlock } = buildMemoryBlock(all, DEFAULT_BUDGET_TOKENS, MEMORY_MAX_CHARS);
        console.log(`   → "all" block contains "${t.expect}": ${allBlock.toLowerCase().includes(t.expect.toLowerCase())}`);
      }
    }
  }

  console.log(`\nResult: ${passed}/${TESTS.length} passed, ${failed} failed`);

  // Show what the full prompt block looks like for "Tell me about Haji".
  console.log("\n--- Sample memory block (budget=800tok / 3000 chars) ---");
  const all = rankMemories(active, undefined, Date.now());
  const { block } = buildMemoryBlock(all, DEFAULT_BUDGET_TOKENS, MEMORY_MAX_CHARS);
  console.log(block);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
