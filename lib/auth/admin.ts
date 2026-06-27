/**
 * Admin gate for debug mode. Admins are configured via the ADMIN_EMAILS
 * environment variable (comma-separated, case-insensitive). Server-only —
 * never trust a client-supplied admin flag.
 */
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}
