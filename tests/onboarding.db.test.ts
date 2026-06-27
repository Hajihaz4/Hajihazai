import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("Google profile + onboarding (db)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let db: any;
  let schema: any;
  let q: any;
  let A = "";
  let B = "";

  async function mkUser(email: string) {
    const [u] = await db.insert(schema.users).values({ email }).returning();
    return u.id as string;
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    q = await import("@/lib/db/profile-queries");
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    A = await mkUser(`ob-A-${s}@example.com`);
    B = await mkUser(`ob-B-${s}@example.com`);
  });

  afterAll(async () => {
    if (!db || !schema || !A) return;
    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [A, B]));
  });

  it("upserts a Google profile on sign-in (new user) and tracks last_login", async () => {
    await q.upsertGoogleProfile({
      userId: A,
      googleId: "google-sub-A",
      email: "ob-A@example.com",
      googleName: "Aaa",
      profilePicture: "https://x/a.png",
    });
    const p = await q.getProfile(A);
    expect(p?.googleId).toBe("google-sub-A");
    expect(p?.googleName).toBe("Aaa");
    expect(p?.lastLogin).toBeTruthy();
    // New user is NOT yet onboarded (no username).
    expect(q.isProfileComplete(p)).toBe(false);
  });

  it("updates last_login on subsequent logins (existing user)", async () => {
    // Force an old last_login, then a fresh upsert must advance it.
    await db
      .update(schema.userProfiles)
      .set({ lastLogin: new Date("2000-01-01T00:00:00Z") })
      .where(eq(schema.userProfiles.userId, A));

    await q.upsertGoogleProfile({
      userId: A,
      googleId: "google-sub-A",
      email: "ob-A@example.com",
      googleName: "Aaa",
      profilePicture: "https://x/a.png",
    });
    const p = await q.getProfile(A);
    expect(new Date(p.lastLogin).getFullYear()).toBeGreaterThan(2000);
  });

  it("reports username availability (case-insensitive)", async () => {
    expect(await q.isUsernameAvailable("FreshName")).toBe(true);
  });

  it("completes onboarding and marks the profile complete", async () => {
    const r = await q.completeOnboarding(A, {
      username: "HajiBoss",
      mobileNumber: "9876543210",
      countryCode: "+91",
    });
    expect(r.ok).toBe(true);
    const p = await q.getProfile(A);
    expect(p?.username).toBe("HajiBoss");
    expect(p?.mobileNumber).toBe("9876543210");
    expect(p?.countryCode).toBe("+91");
    expect(q.isProfileComplete(p)).toBe(true);
    // Now taken (case-insensitive).
    expect(await q.isUsernameAvailable("hajiboss")).toBe(false);
  });

  it("self-heals: completes onboarding when no profile row exists yet (prod bug)", async () => {
    // Reproduces the production failure: the sign-in event never created a
    // profile row, so the user reached onboarding with NO user_profiles record.
    // Previously this returned no_profile → "Profile not found". Now it must
    // create the row from the passed identity and complete successfully.
    const s = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const C = await mkUser(`ob-C-${s}@example.com`);
    // Sanity: this user has no profile row.
    expect(await q.getProfile(C)).toBeNull();

    const r = await q.completeOnboarding(
      C,
      { username: `selfheal-${s}`, mobileNumber: "5551234567", countryCode: "+1" },
      { email: `ob-C-${s}@example.com`, googleName: "Ccc", profilePicture: "" },
    );
    expect(r.ok).toBe(true);
    const p = await q.getProfile(C);
    expect(p?.username).toBe(`selfheal-${s}`);
    expect(p?.email).toBe(`ob-C-${s}@example.com`);
    expect(q.isProfileComplete(p)).toBe(true);

    const { inArray } = await import("drizzle-orm");
    await db.delete(schema.users).where(inArray(schema.users.id, [C]));
  });

  it("rejects a duplicate username case-insensitively (race-safe)", async () => {
    // B already has a profile row from a prior sign-in.
    await q.upsertGoogleProfile({
      userId: B,
      googleId: "google-sub-B",
      email: "ob-B@example.com",
      googleName: "Bbb",
      profilePicture: "",
    });
    const r = await q.completeOnboarding(B, {
      username: "hajiBOSS", // same as A's "HajiBoss", different case
      mobileNumber: "1234567890",
      countryCode: "+1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("username_taken");
    // B is still not onboarded.
    expect(q.isProfileComplete(await q.getProfile(B))).toBe(false);
  });
});
