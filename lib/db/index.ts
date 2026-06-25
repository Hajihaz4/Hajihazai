import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle client. We do NOT throw at import time when DATABASE_URL is missing —
 * importing modules that transitively reach the db (e.g. tools) must not crash
 * in CI / pure unit tests. A placeholder connection string keeps a *real*
 * drizzle instance (needed by the Auth.js adapter's dialect detection); any
 * actual query without a real DATABASE_URL fails at runtime, not at import.
 */
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set — database queries will fail at runtime.");
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export * from "./schema";
