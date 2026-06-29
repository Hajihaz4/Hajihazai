/**
 * Verify all required tables and columns exist in production.
 * Uses neon() tagged template literals (the correct API).
 * Run: node scripts/verify-prod.mjs
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

let pass = 0, fail = 0;

const tables = (await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
`).map(r => r.table_name);

const cols = (await sql`
  SELECT table_name || '.' || column_name AS col
  FROM information_schema.columns
  WHERE table_schema = 'public'
`).map(r => r.col);

const idxs = (await sql`
  SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
`).map(r => r.indexname);

function checkTable(name) {
  const ok = tables.includes(name);
  if (ok) { console.log(`  ✅  table: ${name}`); pass++; }
  else    { console.error(`  ❌  table: ${name} — MISSING`); fail++; }
}
function checkCol(table, col) {
  const ok = cols.includes(`${table}.${col}`);
  if (ok) { console.log(`  ✅  column: ${table}.${col}`); pass++; }
  else    { console.error(`  ❌  column: ${table}.${col} — MISSING`); fail++; }
}
function checkIdx(name) {
  const ok = idxs.includes(name);
  if (ok) { console.log(`  ✅  index: ${name}`); pass++; }
  else    { console.error(`  ❌  index: ${name} — MISSING`); fail++; }
}

console.log("\n🔍  Verifying production schema...\n");

console.log("── Required tables ──");
checkTable("blocked_emails");
checkTable("knowledge_permissions");
checkTable("knowledge_audit_log");
checkTable("system_settings");
checkTable("notifications");
checkTable("user_notifications");
checkTable("brains");
checkTable("conversation");
checkTable("user_profiles");
checkTable("session");

console.log("\n── Required columns ──");
checkCol("user_profiles", "is_disabled");
checkCol("user_profiles", "is_terminated");
checkCol("user_profiles", "is_suspended");
checkCol("user_profiles", "suspended_at");
checkCol("knowledge_document", "brain_id");
checkCol("knowledge_document", "visibility");
checkCol("user_memory", "title");
checkCol("user_memory", "importance");

console.log("\n── Required indexes ──");
checkIdx("conversation_project_idx");
checkIdx("knowledge_document_project_idx");
checkIdx("knowledge_document_brain_idx");
checkIdx("user_profiles_created_idx");
checkIdx("password_reset_expires_idx");
checkIdx("notifications_sent_idx");
checkIdx("user_notifications_notification_idx");

console.log(`\n${fail === 0 ? "✅  ALL CHECKS PASSED" : `❌  ${fail} CHECK(S) FAILED`} — ${pass} ok, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
