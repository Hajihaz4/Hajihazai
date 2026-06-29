/**
 * Quick DB connectivity + schema check using tagged template literals.
 * Run: node scripts/db-check.mjs
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
      const k = t.slice(0, eq).trim(), v = t.slice(eq+1).trim().replace(/^["']|["']$/g,"");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}
loadEnv();

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);

// Test connectivity
const ping = await sql`SELECT 1 AS ok`;
console.log("Connection:", ping[0]?.ok === 1 ? "✅ OK" : "❌ FAILED");

// Check tables using template literal (correct API)
const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;
console.log("\nAll tables in public schema:");
tables.forEach(r => console.log(" ", r.table_name));

// Check user_profiles columns specifically
const cols = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ORDER BY ordinal_position
`;
console.log("\nuser_profiles columns:");
cols.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
