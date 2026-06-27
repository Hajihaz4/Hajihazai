import { getLoginProfile } from "@/lib/db/credential-queries";
import { verifyPassword } from "@/lib/auth/password";
import { createUserSession, isSecureRequest } from "@/lib/auth/session";
import { rateLimitResponse } from "@/lib/ratelimit";

/** Username/email + password login. Mints an Auth.js-compatible DB session. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || !password) {
    return Response.json({ error: "Username and password are required" }, { status: 400 });
  }

  const limited = rateLimitResponse(`login:${identifier.toLowerCase()}`, 10, 60_000);
  if (limited) return limited;

  const profile = await getLoginProfile(identifier);
  // Constant generic error — never reveal whether the account/password exists.
  const invalid = () =>
    Response.json({ error: "Invalid username or password" }, { status: 401 });

  if (!profile?.passwordHash) {
    // Still spend time verifying to reduce timing signal.
    await verifyPassword(password, "scrypt:00:00");
    return invalid();
  }
  const ok = await verifyPassword(password, profile.passwordHash);
  if (!ok) return invalid();

  await createUserSession(profile.userId, isSecureRequest(req));
  return Response.json({ ok: true });
}
