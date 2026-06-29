/**
 * Row counts for all critical tables using tagged template literals.
 * Run: node scripts/row-counts.mjs
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

const [upRow]   = await sql`SELECT COUNT(*)::int AS n FROM user_profiles`;
const [uRow]    = await sql`SELECT COUNT(*)::int AS n FROM "user"`;
const [cRow]    = await sql`SELECT COUNT(*)::int AS n FROM conversation`;
const [mRow]    = await sql`SELECT COUNT(*)::int AS n FROM message`;
const [kdRow]   = await sql`SELECT COUNT(*)::int AS n FROM knowledge_document`;
const [kcRow]   = await sql`SELECT COUNT(*)::int AS n FROM knowledge_chunk`;
const [umRow]   = await sql`SELECT COUNT(*)::int AS n FROM user_memory`;
const [bRow]    = await sql`SELECT COUNT(*)::int AS n FROM brains`;
const [beRow]   = await sql`SELECT COUNT(*)::int AS n FROM blocked_emails`;
const [kpRow]   = await sql`SELECT COUNT(*)::int AS n FROM knowledge_permissions`;
const [kalRow]  = await sql`SELECT COUNT(*)::int AS n FROM knowledge_audit_log`;
const [ssRow]   = await sql`SELECT COUNT(*)::int AS n FROM system_settings`;
const [nRow]    = await sql`SELECT COUNT(*)::int AS n FROM notifications`;
const [unRow]   = await sql`SELECT COUNT(*)::int AS n FROM user_notifications`;
const [prRow]   = await sql`SELECT COUNT(*)::int AS n FROM projects`;
const [tiRow]   = await sql`SELECT COUNT(*)::int AS n FROM tool_invocation`;
const [prtRow]  = await sql`SELECT COUNT(*)::int AS n FROM password_reset_tokens`;
const [asRow]   = await sql`SELECT COUNT(*)::int AS n FROM admin_sessions`;
const [adRow]   = await sql`SELECT COUNT(*)::int AS n FROM admins`;

// Suspension stats
const [suspRow] = await sql`SELECT COUNT(*)::int AS n FROM user_profiles WHERE is_suspended = true`;
const [disRow]  = await sql`SELECT COUNT(*)::int AS n FROM user_profiles WHERE is_disabled = true`;
const [termRow] = await sql`SELECT COUNT(*)::int AS n FROM user_profiles WHERE is_terminated = true`;

// Knowledge visibility
const [privKd]  = await sql`SELECT COUNT(*)::int AS n FROM knowledge_document WHERE visibility = 'private'`;
const [globKd]  = await sql`SELECT COUNT(*)::int AS n FROM knowledge_document WHERE visibility = 'global'`;

console.log("\n📊  Production Row Counts\n");
console.log("── Users & Profiles ──");
console.log(`  users:              ${uRow.n}`);
console.log(`  user_profiles:      ${upRow.n}`);
console.log(`    → is_suspended:   ${suspRow.n}`);
console.log(`    → is_disabled:    ${disRow.n}`);
console.log(`    → is_terminated:  ${termRow.n}`);

console.log("\n── Conversations & Messages ──");
console.log(`  conversations:      ${cRow.n}`);
console.log(`  messages:           ${mRow.n}`);

console.log("\n── Knowledge ──");
console.log(`  knowledge_document: ${kdRow.n}`);
console.log(`    → private:        ${privKd.n}`);
console.log(`    → global:         ${globKd.n}`);
console.log(`  knowledge_chunk:    ${kcRow.n}`);
console.log(`  knowledge_audit:    ${kalRow.n}`);
console.log(`  knowledge_perms:    ${kpRow.n}`);

console.log("\n── Memory ──");
console.log(`  user_memory:        ${umRow.n}`);

console.log("\n── New Feature Tables ──");
console.log(`  brains:             ${bRow.n}`);
console.log(`  blocked_emails:     ${beRow.n}`);
console.log(`  system_settings:    ${ssRow.n}`);
console.log(`  notifications:      ${nRow.n}`);
console.log(`  user_notifications: ${unRow.n}`);

console.log("\n── Admin ──");
console.log(`  admins:             ${adRow.n}`);
console.log(`  admin_sessions:     ${asRow.n}`);

console.log("\n── Other ──");
console.log(`  projects:           ${prRow.n}`);
console.log(`  tool_invocations:   ${tiRow.n}`);
console.log(`  pw_reset_tokens:    ${prtRow.n}`);
console.log();
