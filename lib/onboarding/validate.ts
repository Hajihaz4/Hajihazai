/**
 * Pure server-side validation for onboarding (no imports / side effects).
 * Never trust the client — these run on the server before any DB write.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

export type ValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateUsername(input: unknown): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Username is required" };
  const u = input.trim();
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return { ok: false, error: `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters` };
  }
  if (!/^[A-Za-z0-9_]+$/.test(u)) {
    return { ok: false, error: "Only letters, numbers, and underscore are allowed" };
  }
  return { ok: true, value: u };
}

export function validateCountryCode(input: unknown): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Country code is required" };
  const c = input.trim();
  // E.g. +1, +44, +91, +971
  if (!/^\+\d{1,4}$/.test(c)) return { ok: false, error: "Invalid country code" };
  return { ok: true, value: c };
}

export function validateMobile(input: unknown): ValidationResult {
  if (typeof input !== "string") return { ok: false, error: "Mobile number is required" };
  const digits = input.replace(/[\s()-]/g, "");
  if (!/^\d{6,15}$/.test(digits)) {
    return { ok: false, error: "Enter a valid mobile number (6–15 digits)" };
  }
  return { ok: true, value: digits };
}
