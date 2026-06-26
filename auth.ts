import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";
import { upsertGoogleProfile } from "@/lib/db/profile-queries";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required behind a custom domain / proxy on Vercel.
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
  events: {
    // Every login: upsert the Google profile (googleId/email/name/picture) and
    // bump last_login. Best-effort — never block sign-in if this fails.
    async signIn({ user, profile }) {
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
    },
  },
  callbacks: {
    // Database session strategy: expose the persisted user id to the client.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
