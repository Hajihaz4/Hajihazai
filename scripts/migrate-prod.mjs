/**
 * Production hardening migration — safe to run multiple times.
 * Uses neon() tagged template literals (the correct API for @neondatabase/serverless).
 * Each statement is a separate call; CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
 * ensure idempotency.
 *
 * Run: node scripts/migrate-prod.mjs
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
  } catch { /* rely on process.env */ }
}

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌  DATABASE_URL is not set"); process.exit(1); }

const { neon } = await import("@neondatabase/serverless");
const sql = neon(DATABASE_URL);

let pass = 0, fail = 0;

async function step(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    pass++;
  } catch (err) {
    console.error(`  ❌  ${label}: ${err?.message ?? err}`);
    fail++;
  }
}

console.log("\n🔧  Running production migration...\n");

// ── New tables ──────────────────────────────────────────────────────────────

await step("blocked_emails table", () => sql`
  CREATE TABLE IF NOT EXISTS "blocked_emails" (
    "id"         text PRIMARY KEY NOT NULL,
    "email"      text NOT NULL,
    "reason"     text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "blocked_emails_email_unique" UNIQUE("email")
  )
`);
await step("blocked_emails index", () => sql`
  CREATE INDEX IF NOT EXISTS "blocked_emails_email_idx" ON "blocked_emails" USING btree ("email")
`);

await step("knowledge_permissions table", () => sql`
  CREATE TABLE IF NOT EXISTS "knowledge_permissions" (
    "id"         text PRIMARY KEY NOT NULL,
    "email"      text NOT NULL,
    "granted_by" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "knowledge_permissions_email_unique" UNIQUE("email")
  )
`);
await step("knowledge_permissions index", () => sql`
  CREATE INDEX IF NOT EXISTS "knowledge_permissions_email_idx" ON "knowledge_permissions" USING btree ("email")
`);

await step("knowledge_audit_log table", () => sql`
  CREATE TABLE IF NOT EXISTS "knowledge_audit_log" (
    "id"             text PRIMARY KEY NOT NULL,
    "user_id"        text,
    "email"          text NOT NULL,
    "action"         text NOT NULL,
    "document_id"    text,
    "document_title" text NOT NULL,
    "content_before" text,
    "content_after"  text,
    "created_at"     timestamp DEFAULT now() NOT NULL
  )
`);
await step("knowledge_audit_log indexes", async () => {
  await sql`CREATE INDEX IF NOT EXISTS "knowledge_audit_log_user_idx" ON "knowledge_audit_log" USING btree ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "knowledge_audit_log_created_idx" ON "knowledge_audit_log" USING btree ("created_at")`;
});
await step("knowledge_audit_log FK", () => sql`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'knowledge_audit_log_user_id_fk' AND table_name = 'knowledge_audit_log'
    ) THEN
      ALTER TABLE "knowledge_audit_log"
        ADD CONSTRAINT "knowledge_audit_log_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;
    END IF;
  END $$
`);

await step("system_settings table", () => sql`
  CREATE TABLE IF NOT EXISTS "system_settings" (
    "key"        text PRIMARY KEY NOT NULL,
    "value"      text NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )
`);

await step("notifications table", () => sql`
  CREATE TABLE IF NOT EXISTS "notifications" (
    "id"          text PRIMARY KEY NOT NULL,
    "title"       text NOT NULL,
    "message"     text NOT NULL,
    "target_type" text DEFAULT 'all' NOT NULL,
    "sent_at"     timestamp,
    "created_by"  text,
    "created_at"  timestamp DEFAULT now() NOT NULL
  )
`);
await step("notifications indexes", async () => {
  await sql`CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" USING btree ("created_at")`;
  await sql`CREATE INDEX IF NOT EXISTS "notifications_sent_idx" ON "notifications" USING btree ("sent_at")`;
});

await step("user_notifications table", () => sql`
  CREATE TABLE IF NOT EXISTS "user_notifications" (
    "id"              text PRIMARY KEY NOT NULL,
    "user_id"         text NOT NULL,
    "notification_id" text NOT NULL,
    "is_read"         boolean DEFAULT false NOT NULL,
    "read_at"         timestamp,
    "created_at"      timestamp DEFAULT now() NOT NULL
  )
`);
await step("user_notifications FKs", async () => {
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                     WHERE constraint_name = 'user_notifications_user_id_fk')
      THEN ALTER TABLE "user_notifications"
        ADD CONSTRAINT "user_notifications_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                     WHERE constraint_name = 'user_notifications_notification_id_fk')
      THEN ALTER TABLE "user_notifications"
        ADD CONSTRAINT "user_notifications_notification_id_fk"
        FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE;
      END IF;
    END $$
  `;
});
await step("user_notifications indexes", async () => {
  await sql`CREATE INDEX IF NOT EXISTS "user_notifications_user_idx" ON "user_notifications" USING btree ("user_id")`;
  await sql`CREATE INDEX IF NOT EXISTS "user_notifications_notification_idx" ON "user_notifications" USING btree ("notification_id")`;
});

// ── New columns on user_profiles ────────────────────────────────────────────

await step("user_profiles.is_disabled",   () => sql`ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "is_disabled" boolean DEFAULT false NOT NULL`);
await step("user_profiles.is_terminated", () => sql`ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "is_terminated" boolean DEFAULT false NOT NULL`);
await step("user_profiles.is_suspended",  () => sql`ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "is_suspended" boolean DEFAULT false NOT NULL`);
await step("user_profiles.suspended_at",  () => sql`ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp`);

// ── Performance indexes ──────────────────────────────────────────────────────

await step("index conversation(project_id)",        () => sql`CREATE INDEX IF NOT EXISTS "conversation_project_idx" ON "conversation" USING btree ("project_id")`);
await step("index knowledge_document(project_id)",  () => sql`CREATE INDEX IF NOT EXISTS "knowledge_document_project_idx" ON "knowledge_document" USING btree ("project_id")`);
await step("index knowledge_document(brain_id)",    () => sql`CREATE INDEX IF NOT EXISTS "knowledge_document_brain_idx" ON "knowledge_document" USING btree ("brain_id")`);
await step("index user_profiles(created_at)",       () => sql`CREATE INDEX IF NOT EXISTS "user_profiles_created_idx" ON "user_profiles" USING btree ("created_at")`);
await step("index password_reset_tokens(expires_at)", () => sql`CREATE INDEX IF NOT EXISTS "password_reset_expires_idx" ON "password_reset_tokens" USING btree ("expires_at")`);

console.log(`\n${fail === 0 ? "✅  All" : `❌  ${fail} of ${pass+fail}`} steps ${fail === 0 ? "passed" : "FAILED"} (${pass} ok, ${fail} failed)\n`);
process.exit(fail > 0 ? 1 : 0);
