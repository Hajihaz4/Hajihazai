import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { userProfiles, type UserProfile } from "./schema";

/**
 * Google profile + onboarding data layer.
 * Case-insensitive username uniqueness + race safety are enforced by the
 * DB functional unique index on lower(username) (migration 0012).
 */

function isUniqueViolation(err: unknown): boolean {
  // drizzle wraps the NeonDbError ("Failed query …"); the Postgres code 23505
  // and the "duplicate key" message live on the cause chain.
  let e = err as { code?: string; message?: string; cause?: unknown } | null;
  for (let i = 0; i < 5 && e; i++) {
    if (e.code === "23505") return true;
    if (/duplicate key|unique constraint/i.test(String(e.message ?? ""))) {
      return true;
    }
    e = e.cause as typeof e;
  }
  return false;
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const [row] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));
  return row ?? null;
}

/** A profile is "complete" (onboarded) once it has a username. */
export function isProfileComplete(profile: UserProfile | null): boolean {
  return Boolean(profile && profile.username && profile.username.trim());
}

/**
 * Create-or-update the user's Google profile on sign-in, and bump last_login.
 * Username/mobile are left untouched (set later during onboarding).
 */
export async function upsertGoogleProfile(input: {
  userId: string;
  googleId: string;
  email: string;
  googleName: string;
  profilePicture: string;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(userProfiles)
    .values({
      userId: input.userId,
      googleId: input.googleId || null,
      email: input.email,
      googleName: input.googleName || null,
      profilePicture: input.profilePicture || null,
      lastLogin: now,
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        googleId: input.googleId || null,
        email: input.email,
        googleName: input.googleName || null,
        profilePicture: input.profilePicture || null,
        lastLogin: now,
        updatedAt: now,
      },
    });
}

/** Case-insensitive availability check (advisory; the DB index is the guard). */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const rows = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(sql`lower(${userProfiles.username}) = lower(${username})`);
  return rows.length === 0;
}

/**
 * Complete onboarding: set username + mobile on the user's profile.
 * Race-safe: a concurrent claim of the same username triggers a unique
 * violation (23505) which we surface as "username_taken".
 */
export async function completeOnboarding(
  userId: string,
  input: { username: string; mobileNumber: string; countryCode: string },
): Promise<
  | { ok: true; profile: UserProfile }
  | { ok: false; error: "username_taken" | "no_profile" }
> {
  try {
    const [row] = await db
      .update(userProfiles)
      .set({
        username: input.username,
        mobileNumber: input.mobileNumber,
        countryCode: input.countryCode,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId))
      .returning();
    if (!row) return { ok: false, error: "no_profile" };
    return { ok: true, profile: row };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "username_taken" };
    throw err;
  }
}
