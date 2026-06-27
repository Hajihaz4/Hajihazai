/**
 * Seed the first admin from a trusted environment (NOT a public endpoint).
 *
 *   ADMIN_SEED_USERNAME=haji ADMIN_SEED_PASSWORD='strong-pass' npm run seed:admin
 *
 * Produces a scrypt hash in the exact format lib/auth/password.ts verifies
 * (`scrypt:<saltHex>:<keyHex>`). Idempotent: does nothing if the username
 * already exists. Run again with a different username to add more admins, or
 * use the in-portal "Create Admin" once an admin is logged in.
 */
import { neon } from "@neondatabase/serverless";
import { scryptSync, randomBytes, randomUUID } from "node:crypto";

const username = process.env.ADMIN_SEED_USERNAME || process.argv[2];
const password = process.env.ADMIN_SEED_PASSWORD || process.argv[3];

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!username || !password) {
  console.error(
    "Usage: ADMIN_SEED_USERNAME=<name> ADMIN_SEED_PASSWORD=<pass> npm run seed:admin",
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pw, salt, 64);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

const sql = neon(process.env.DATABASE_URL);
const existing = await sql.query("select id from admins where username = $1", [
  username,
]);
if (existing.length > 0) {
  console.log(`Admin "${username}" already exists — nothing to do.`);
  process.exit(0);
}

const id = randomUUID();
await sql.query(
  "insert into admins (id, username, password_hash, created_at) values ($1, $2, $3, now())",
  [id, username, hashPassword(password)],
);
console.log(`✓ Seeded admin "${username}".`);
