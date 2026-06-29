import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens, userProfiles } from "@/lib/db/schema";
import { upsertGoogleProfile } from "@/lib/db/profile-queries";
import { isEmailBlocked } from "@/lib/admin/queries";
import { syncUserToSheets } from "@/lib/google-sheets";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    // Block terminated / banned / disabled / suspended accounts before creating a session.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (email) {
        try {
          const blocked = await isEmailBlocked(email);
          if (blocked) {
            console.warn(`[auth] blocked email attempted Google sign-in: ${email}`);
            return false;
          }
          // Also block disabled and suspended accounts (password login checks isDisabled,
          // but OAuth bypassed that check)
          const [profile] = await db
            .select({ isDisabled: userProfiles.isDisabled })
            .from(userProfiles)
            .where(eq(userProfiles.email, email))
            .limit(1);
          if (profile?.isDisabled) {
            console.warn(`[auth] disabled account attempted Google sign-in: ${email}`);
            return false;
          }
        } catch (err) {
          console.error("[auth] sign-in check failed (non-fatal):", err);
        }
      }
      return true;
    },
    // Database session strategy: expose the persisted user id to the client.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // Every sign-in: upsert the Google profile and bump last_login.
    async signIn({ user, profile, isNewUser }) {
      if (!user?.id) return;
      try {
        await upsertGoogleProfile({
          userId: user.id,
          googleId: (profile?.sub as string | undefined) ?? "",
          email: (profile?.email as string | undefined) ?? user.email ?? "",
          googleName: (profile?.name as string | undefined) ?? user.name ?? "",
          profilePicture:
            (profile?.picture as string | undefined) ?? user.image ?? "",
        });
      } catch (err) {
        console.error("[auth] profile upsert failed (non-fatal):", err);
      }

      // Sync new Google registrations to Sheets (non-blocking)
      if (isNewUser && user.email) {
        syncUserToSheets({
          email: user.email,
          name: user.name,
          source: "google",
          createdAt: new Date(),
        });
      }
    },
  },
});
