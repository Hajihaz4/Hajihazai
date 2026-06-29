/**
 * Seeds Haji's initial memory set from known profile facts.
 * Run ONCE to populate the user_memory table.
 * Run: npx tsx --env-file=.env.local scripts/seed-haji-memories.ts
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createMemory } from "@/lib/db/memory-queries";
import { embedMemory } from "@/lib/memory/embed-memory";

const HAJI_ID = "385b652a-e30f-4a22-b26b-415840e4ec11";

const MEMORIES: Array<{ type: string; content: string }> = [
  // Identity
  { type: "identity", content: "Full name is Syed Hasan Kuddos Sahib, preferred name is Haji." },
  { type: "identity", content: "Date of birth is 29 March 2004." },
  { type: "identity", content: "Born in Nagapattinam; native place is Nagore, Tamil Nadu, India." },
  { type: "identity", content: "Religion is Islam. Languages: Tamil and English." },
  { type: "identity", content: "Current location is Potheri, Kattankulathur, Chennai." },
  // Education
  { type: "fact", content: "Completed BBA in Financial Services from B.S. Abdur Rahman Crescent Institute of Science and Technology, Vandalur, Chennai in 2024 with CGPA 7.5." },
  { type: "fact", content: "Currently studying LLB (Hons) at SRM School of Law, Kattankulathur (2025-2028). Favorite subject is Company Law." },
  { type: "goal", content: "Career goal is to become a Corporate Lawyer specialising in Corporate Law." },
  // Family
  { type: "fact", content: "Father is Syed Mohamed Hussain Sahib (B.Com, MBA), founder of RKN Associates." },
  { type: "fact", content: "Mother is Shehnaz Nisha, housewife." },
  { type: "fact", content: "Sister Hidhayaa married on 06 June 2026." },
  { type: "fact", content: "Maternal aunt is Safina Thangam (mother Shehnaz Nisha's sister), married to Kabeer Sahib. Their children are Mohammed Hamza Sahib, Sadath Nisa, and Sahabuddin Sahib." },
  { type: "fact", content: "Has a very close bond with cousin Sahabuddin Sahib since childhood." },
  { type: "fact", content: "Paternal grandfather Syed Hasan Kuddos Sahib — Haji is named after him." },
  // Friends
  { type: "fact", content: "Closest friends are Azees (childhood friend and family relative, DOB 11 May 2003), Ali (business partner, co-founder of AllBee), Kaif (school-to-UG friend, now in Dubai), and Abdul (childhood friend)." },
  { type: "fact", content: "Current roommates are Selva and Sundar at VGN Southern Avenue, Potheri." },
  // Businesses
  { type: "fact", content: "Founded Suplaykart on 01 January 2025 — hyperlocal commerce platform for Nagore (like Blinkit + Zepto + Zomato). Temporarily closed from 01 June 2026, planned reopening 01 January 2027." },
  { type: "fact", content: "Co-founder and CFO (30% ownership) of AllBee Solutions — digital solutions and technology services agency founded 2025, partner is Ali." },
  { type: "fact", content: "Director of Strategy and Finance at RKN Associates (father's construction and interior solutions company)." },
  // Preferences
  { type: "preference", content: "Favorite color is white." },
  { type: "preference", content: "Favorite foods are Biryani and Fried Rice." },
  { type: "preference", content: "Favorite smartphone is iPhone. Favorite car is Lexus." },
  { type: "preference", content: "Favorite clothing brand is Andamen. Favorite sunglass brands are Ray-Ban and David Beckham Eyewear." },
  // Goals
  { type: "goal", content: "One-year goal: successfully relaunch and stabilise Suplaykart." },
  { type: "goal", content: "Five-year goal: become a successful Corporate Lawyer." },
  { type: "goal", content: "Ten-year goal: build a legacy that surprises the world and makes Nagore proud." },
  // Personality
  { type: "fact", content: "Personality traits: Ambitious, Entrepreneurial, Strategic, Growth-Oriented, Resilient, Practical, Curious, Long-Term Thinker." },
  { type: "preference", content: "Prefers direct and practical answers." },
  { type: "fact", content: "Hobbies: Walking, Football, Cricket, PUBG, Building Businesses, Thinking About Systems, Entrepreneurship." },
  // Status
  { type: "fact", content: "Not currently in a romantic relationship. Focused on personal growth, education and business." },
];

async function main() {
  // Clear any existing test memories (idempotent run).
  const existing = await db.select({ id: userMemory.id }).from(userMemory).where(eq(userMemory.userId, HAJI_ID));
  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing memories — skipping seed (run forget-all first to re-seed).`);
    process.exit(0);
  }

  console.log(`Seeding ${MEMORIES.length} memories for Haji...\n`);
  let ok = 0;
  let embOk = 0;

  for (const m of MEMORIES) {
    const row = await createMemory(HAJI_ID, { type: m.type, content: m.content, status: "active" });
    ok++;
    try {
      await embedMemory(HAJI_ID, row.id);
      embOk++;
      process.stdout.write(".");
    } catch {
      process.stdout.write("x");
    }
  }

  console.log(`\n\nCreated: ${ok}  Embedded: ${embOk}/${ok}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
