/**
 * Create the schema in your TEST database (never production).
 *
 * Resolves the test DB URL from TEST_DATABASE_URL (or DATABASE_URL in .env.test),
 * refuses to run against the known production host, then applies the Drizzle
 * migrations against it via `drizzle-kit migrate`.
 *
 * Run once after configuring .env.test:
 *   node scripts/setup-test-db.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  try {
    const lines = readFileSync(resolve(__dirname, "..", file), "utf8").split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v; // first loader wins (.env.test before .env.local)
    }
  } catch {
    /* file optional */
  }
}

// .env.test first so its keys win, then .env.local for anything else.
loadEnv(".env.test");
loadEnv(".env.local");

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

// Same guard as vitest.setup.ts — never migrate the production database.
const PROD_DB_HOST_FRAGMENTS = ["ep-little-glade-ao9fsoew"];
const matched = PROD_DB_HOST_FRAGMENTS.find((h) => url.includes(h));

if (!url) {
  console.error("\n❌  No test database URL found. Set TEST_DATABASE_URL or add DATABASE_URL to .env.test.\n   See .env.test.example.\n");
  process.exit(1);
}
if (matched) {
  console.error(`\n✋  Refusing to migrate the PRODUCTION database (matched "${matched}").\n   Point TEST_DATABASE_URL at a Neon branch or local Postgres instead.\n`);
  process.exit(1);
}

const host = (url.match(/@([^/?]+)/) || [])[1] || "?";
console.log(`\n🧪  Applying schema to test database: ${host.slice(0, 40)}\n`);

try {
  // drizzle.config.ts reads process.env.DATABASE_URL; override it for this run.
  execSync("npx drizzle-kit migrate", {
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  console.log("\n✅  Test database schema is ready. Run `npm test`.\n");
} catch (err) {
  console.error("\n❌  Migration failed:", err.message, "\n");
  process.exit(1);
}
