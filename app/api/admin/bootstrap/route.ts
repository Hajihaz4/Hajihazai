import { countAdmins, createAdmin } from "@/lib/admin/queries";
import { createAdminSession } from "@/lib/admin/session";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { isSecureRequest } from "@/lib/auth/session";
import { rateLimitResponse } from "@/lib/ratelimit";

/**
 * One-time bootstrap: create the FIRST admin when none exist yet. Once any
 * admin exists this endpoint is permanently locked (new admins are created
 * from inside the portal by an authenticated admin).
 */
export async function POST(req: Request) {
  const limited = rateLimitResponse("admin-bootstrap", 5, 60_000);
  if (limited) return limited;

  if ((await countAdmins()) > 0) {
    return Response.json({ error: "Admin already initialised" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  if (username.length < 3) {
    return Response.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  }
  const pw = validatePassword(body?.password);
  if (!pw.ok) return Response.json({ error: pw.error }, { status: 400 });

  const result = await createAdmin({
    username,
    passwordHash: await hashPassword(pw.value),
    createdBy: null,
  });
  if (!result.ok) {
    return Response.json({ error: "That admin username is taken" }, { status: 409 });
  }
  await createAdminSession(result.id, isSecureRequest(req));
  return Response.json({ ok: true });
}
