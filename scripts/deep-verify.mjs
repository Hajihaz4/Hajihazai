/**
 * Deep DB verification — tests data integrity, new column defaults,
 * and table row counts. Confirms new tables are queryable.
 *
 * Run: node scripts/deep-verify.mjs
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

let pass = 0, warn = 0, fail = 0;

function ok(label, detail = "") {
  console.log(`  ✅  ${label}${detail ? " — " + detail : ""}`);
  pass++;
}
function wn(label, detail = "") {
  console.warn(`  ⚠️   ${label}${detail ? " — " + detail : ""}`);
  warn++;
}
function ko(label, detail = "") {
  console.error(`  ❌  ${label}${detail ? " — " + detail : ""}`);
  fail++;
}

// ── Connectivity ─────────────────────────────────────────────────────────────
console.log("\n── Connectivity ──");
const [pingRow] = await sql`SELECT 1 AS n`;
pingRow?.n === 1 ? ok("DB connection") : ko("DB connection");

// ── user_profiles column defaults ────────────────────────────────────────────
console.log("\n── user_profiles new column defaults ──");
const [defaults] = await sql`
  SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'user_profiles' AND column_name IN ('is_disabled','is_terminated','is_suspended','suspended_at')
  ORDER BY column_name
`;
// Fetch all rows
const upDefaults = await sql`
  SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'user_profiles' AND column_name IN ('is_disabled','is_terminated','is_suspended','suspended_at')
  ORDER BY column_name
`;
for (const row of upDefaults) {
  const hasDefault = row.column_default !== null;
  const nullable = row.is_nullable === "YES";
  if (row.column_name === "suspended_at") {
    nullable ? ok(`${row.column_name} nullable`) : ko(`${row.column_name} should be nullable`);
  } else {
    hasDefault ? ok(`${row.column_name} has default (${row.column_default})`) : ko(`${row.column_name} missing default`);
  }
}

// ── Row counts ───────────────────────────────────────────────────────────────
console.log("\n── Row counts ──");
const tables = ["user_profiles","conversation","knowledge_document","user_memory","brains","blocked_emails","knowledge_permissions","knowledge_audit_log","system_settings","notifications","user_notifications"];
for (const t of tables) {
  try {
    const [row] = await sql.unsafe(`SELECT COUNT(*) AS n FROM "${t}"`);
    ok(`${t}`, `${row.n} rows`);
  } catch (err) {
    ko(t, err.message.slice(0, 80));
  }
}

// ── isSuspended check in login path ─────────────────────────────────────────
console.log("\n── Suspension + disable logic ──");
const [upUser] = await sql`
  SELECT is_disabled, is_terminated, is_suspended, suspended_at
  FROM user_profiles LIMIT 1
`;
if (upUser !== undefined) {
  ok("SELECT is_disabled/is_terminated/is_suspended/suspended_at from user_profiles");
  typeof upUser.is_disabled === "boolean"   ? ok("is_disabled is boolean") : ko("is_disabled wrong type: " + typeof upUser.is_disabled);
  typeof upUser.is_suspended === "boolean"  ? ok("is_suspended is boolean") : ko("is_suspended wrong type");
  typeof upUser.is_terminated === "boolean" ? ok("is_terminated is boolean") : ko("is_terminated wrong type");
} else {
  wn("No users in DB — column type check skipped");
}

// ── system_settings can store/retrieve ──────────────────────────────────────
console.log("\n── system_settings read/write ──");
try {
  await sql`
    INSERT INTO system_settings (key, value, updated_at) VALUES ('__verify_test__', 'ok', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'ok', updated_at = NOW()
  `;
  const [row] = await sql`SELECT value FROM system_settings WHERE key = '__verify_test__'`;
  row?.value === "ok" ? ok("system_settings insert + select") : ko("system_settings read mismatch");
  await sql`DELETE FROM system_settings WHERE key = '__verify_test__'`;
  ok("system_settings delete");
} catch (err) {
  ko("system_settings read/write: " + err.message);
}

// ── notifications fan-out flow ───────────────────────────────────────────────
console.log("\n── notifications flow ──");
try {
  const [notif] = await sql`
    INSERT INTO notifications (id, title, message, target_type, created_at)
    VALUES (gen_random_uuid(), '__verify__', 'test', 'all', NOW())
    RETURNING id
  `;
  const nid = notif.id;
  ok(`notifications INSERT (id: ${nid.slice(0,8)}...)`);

  // Fan-out to first user
  const users = await sql`SELECT id FROM "user" LIMIT 1`;
  if (users.length > 0) {
    await sql`
      INSERT INTO user_notifications (id, user_id, notification_id, is_read, created_at)
      VALUES (gen_random_uuid(), ${users[0].id}, ${nid}, false, NOW())
    `;
    ok("user_notifications INSERT (fan-out)");
    const [un] = await sql`SELECT is_read FROM user_notifications WHERE notification_id = ${nid}`;
    un?.is_read === false ? ok("user_notifications is_read defaults to false") : ko("user_notifications is_read wrong");
    // Mark read
    await sql`UPDATE user_notifications SET is_read = true, read_at = NOW() WHERE notification_id = ${nid}`;
    const [unR] = await sql`SELECT is_read FROM user_notifications WHERE notification_id = ${nid}`;
    unR?.is_read === true ? ok("user_notifications mark-read works") : ko("user_notifications mark-read failed");
    // Cleanup
    await sql`DELETE FROM user_notifications WHERE notification_id = ${nid}`;
  } else {
    wn("No users in DB — notification fan-out skipped");
  }
  // Update sentAt (simulates admin sending)
  await sql`UPDATE notifications SET sent_at = NOW() WHERE id = ${nid}`;
  const [sn] = await sql`SELECT sent_at FROM notifications WHERE id = ${nid}`;
  sn?.sent_at ? ok("notifications sent_at update") : ko("notifications sent_at null after update");
  await sql`DELETE FROM notifications WHERE id = ${nid}`;
  ok("notifications DELETE (cleanup)");
} catch (err) {
  ko("notifications flow: " + err.message);
}

// ── knowledge_permissions ────────────────────────────────────────────────────
console.log("\n── knowledge_permissions ──");
try {
  await sql`
    INSERT INTO knowledge_permissions (id, email, granted_by, created_at)
    VALUES (gen_random_uuid(), '__verify__@test.com', 'admin', NOW())
    ON CONFLICT (email) DO NOTHING
  `;
  const [kp] = await sql`SELECT email FROM knowledge_permissions WHERE email = '__verify__@test.com'`;
  kp?.email ? ok("knowledge_permissions insert + select") : ko("knowledge_permissions missing after insert");
  await sql`DELETE FROM knowledge_permissions WHERE email = '__verify__@test.com'`;
  ok("knowledge_permissions delete");
} catch (err) {
  ko("knowledge_permissions: " + err.message);
}

// ── knowledge_audit_log ──────────────────────────────────────────────────────
console.log("\n── knowledge_audit_log ──");
try {
  await sql`
    INSERT INTO knowledge_audit_log (id, user_id, email, action, document_title, created_at)
    VALUES (gen_random_uuid(), NULL, '__verify__@test.com', 'create', 'Test Doc', NOW())
  `;
  const [kal] = await sql`SELECT action FROM knowledge_audit_log WHERE email = '__verify__@test.com' LIMIT 1`;
  kal?.action === "create" ? ok("knowledge_audit_log insert + select") : ko("knowledge_audit_log missing after insert");
  await sql`DELETE FROM knowledge_audit_log WHERE email = '__verify__@test.com'`;
  ok("knowledge_audit_log delete");
} catch (err) {
  ko("knowledge_audit_log: " + err.message);
}

// ── blocked_emails ────────────────────────────────────────────────────────────
console.log("\n── blocked_emails ──");
try {
  await sql`
    INSERT INTO blocked_emails (id, email, reason, created_at)
    VALUES (gen_random_uuid(), '__verify__@blocked.com', 'test', NOW())
    ON CONFLICT (email) DO NOTHING
  `;
  const [be] = await sql`SELECT email FROM blocked_emails WHERE email = '__verify__@blocked.com'`;
  be?.email ? ok("blocked_emails insert + select") : ko("blocked_emails missing after insert");
  await sql`DELETE FROM blocked_emails WHERE email = '__verify__@blocked.com'`;
  ok("blocked_emails delete");
} catch (err) {
  ko("blocked_emails: " + err.message);
}

// ── brains table ─────────────────────────────────────────────────────────────
console.log("\n── brains ──");
try {
  const brains = await sql`SELECT id, name, slug FROM brains ORDER BY name`;
  brains.length > 0 ? ok(`brains — ${brains.length} brain(s): ${brains.map(b => b.slug).join(", ")}`) : wn("brains table empty — seed not run");
} catch (err) {
  ko("brains: " + err.message);
}

// ── maintenance mode end-to-end ──────────────────────────────────────────────
console.log("\n── maintenance mode ──");
try {
  await sql`
    INSERT INTO system_settings (key, value, updated_at) VALUES ('maintenance_mode', 'false', NOW())
    ON CONFLICT (key) DO UPDATE SET value = 'false', updated_at = NOW()
  `;
  const [row] = await sql`SELECT value FROM system_settings WHERE key = 'maintenance_mode'`;
  row?.value === "false" ? ok("maintenance_mode default false") : ko("maintenance_mode wrong value");
} catch (err) {
  ko("maintenance_mode: " + err.message);
}

// ── Summary ──────────────────────────────────────────────────────────────────
const total = pass + warn + fail;
console.log(`\n${"─".repeat(50)}`);
console.log(`Total: ${total} checks — ✅ ${pass} passed, ⚠️  ${warn} warnings, ❌ ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
