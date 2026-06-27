import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing + secure tokens using Node's crypto (no external deps,
 * serverless-safe). Passwords are stored as scrypt hashes; plaintext is never
 * persisted. Reset tokens are random and only their SHA-256 hash is stored.
 */

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

/** A reset/session token: the raw value goes in the link; we store its hash. */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validatePassword(pw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof pw !== "string" || pw.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  if (pw.length > 200) return { ok: false, error: "Password is too long" };
  return { ok: true, value: pw };
}
