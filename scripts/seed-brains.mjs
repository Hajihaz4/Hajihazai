/**
 * Seed the 4 system brains. Safe to run multiple times (ON CONFLICT DO NOTHING).
 * Run: node scripts/seed-brains.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const lines = readFileSync(resolve(__dirname, "../.env.local"), "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnv();

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

const before = await sql`SELECT COUNT(*)::int AS n FROM brains`;
console.log(`\nBrains before: ${before[0].n}`);

await sql`
  INSERT INTO brains (id, name, slug, description, icon, color, is_system, created_at, updated_at)
  VALUES
    (gen_random_uuid(), 'Haji Core',        'haji-core',  'Personal identity, family, education, goals, friends, hobbies, preferences, life story.', '🧠', '#6366f1', true, NOW(), NOW()),
    (gen_random_uuid(), 'Suplaykart Brain', 'suplaykart', 'Business operations, vendors, delivery model, finances, growth plans, roadmap, marketing.', '🏪', '#10b981', true, NOW(), NOW()),
    (gen_random_uuid(), 'AllBee Brain',     'allbee',     'Clients, projects, services, pricing, digital marketing, development operations.',            '🚀', '#f59e0b', true, NOW(), NOW()),
    (gen_random_uuid(), 'Legal Brain',      'legal',      'LLB notes, constitutional law, company law, case law, legal studies, exam preparation.',     '⚖️', '#8b5cf6', true, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING
`;

const after = await sql`SELECT id, name, slug FROM brains ORDER BY name`;
console.log(`Brains after:  ${after.length}`);
after.forEach(b => console.log(`  ✅  ${b.slug} — ${b.name}`));
console.log();
