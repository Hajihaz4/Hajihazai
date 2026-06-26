# Google Auth + Onboarding — Deployment Notes

Replaces GitHub auth with **Google OAuth only** and adds mandatory onboarding
(username + mobile) with Google Sheets submission.

## Environment variables (Vercel → Production)

| Variable | Required | Notes |
|---|---|---|
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth **client ID** (existing credentials). |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth **client secret**. |
| `AUTH_SECRET`, `AUTH_URL` | ✅ | Unchanged. `AUTH_URL=https://<domain>`. |
| `DATABASE_URL` | ✅ | Neon. Run migration `0012` before deploy. |
| `GOOGLE_SHEETS_WEBHOOK_URL` | ⛔ optional | Apps Script `/exec` URL. If unset, Sheets submission is skipped (logged, non-fatal). |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | ➖ remove | No longer used. Safe to delete. |

## Google Cloud Console (OAuth client)
- Authorized redirect URI: `https://<domain>/api/auth/callback/google`
- Authorized JavaScript origin: `https://<domain>`
- OAuth consent screen published (or test users added).

## Database
- Migration `0012_dry_zombie.sql` creates `user_profiles` and a **case-insensitive
  unique index** `user_profiles_username_lower_unique` on `lower(username)` —
  this is what enforces username uniqueness AND prevents signup race conditions.
- Apply: `DATABASE_URL=<prod> npm run db:migrate`.

## Migration (existing sessions)
- Database sessions are unchanged, so **already-logged-in users stay logged in**.
- Existing users have **no profile** → on next visit they are redirected to
  `/onboarding` to pick a username + mobile (one-time). New users go through the
  same flow after their first Google sign-in.

## Flow
1. Google sign-in → Auth.js `events.signIn` upserts the profile
   (`googleId/email/googleName/profilePicture`) and **updates `last_login`**.
2. `/` checks the profile: complete → chat; incomplete → redirect `/onboarding`.
3. Onboarding (3 steps): username (real-time availability) → mobile + country
   code → complete. Server-validated; race-safe insert; then best-effort POST to
   the Sheets webhook with `{ username, email, mobile, countryCode, googleName,
   googleId, picture }`.

## Google Apps Script (Sheets) — example
```js
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Signups");
  sh.appendRow([new Date(), d.username, d.email, d.countryCode, d.mobile,
                d.googleName, d.googleId, d.picture]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```
Deploy as a Web App (Execute as: Me; Access: Anyone). Use the `/exec` URL.

## Post-deploy verification
1. Sign in with Google → first-time users land on `/onboarding`.
2. Type a username → real-time "available/taken" indicator.
3. Try a taken username (any case) → rejected (409).
4. Complete → redirected to chat; a row appears in the Sheet (if webhook set).
5. Sign out / back in → goes straight to chat (profile complete), `last_login` updates.
