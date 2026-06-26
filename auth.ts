import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions, verificationTokens } from "@/lib/db/schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Trust the deployment host (required behind a custom domain / proxy on
  // Vercel — otherwise Auth.js v5 can throw a Configuration error and build
  // bad callback URLs). Also settable via AUTH_TRUST_HOST=true.
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    // Explicit credentials (no reliance on Auth.js env-name inference). Reads
    // the same AUTH_GITHUB_ID / AUTH_GITHUB_SECRET set in the environment.
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    // Database session strategy: expose the persisted user id to the client.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
});
