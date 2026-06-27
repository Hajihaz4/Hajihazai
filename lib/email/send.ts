/**
 * Email adapter. No provider is configured yet, so the password-reset link is
 * logged server-side (deliver manually / wire a provider like Resend later).
 * The link is NEVER returned to the client — that would leak the reset token
 * and enable account enumeration.
 */

export interface SendResult {
  delivered: boolean;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<SendResult> {
  // TODO: wire a real provider here (Resend/SMTP) once configured.
  console.log(`[email] password reset requested for ${to} -> ${resetUrl}`);
  return { delivered: false };
}
