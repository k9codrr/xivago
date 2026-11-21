import type { NextAuthConfig } from "next-auth";
import type { Role } from "@slotbook/db";

/**
 * The Edge-safe subset of our NextAuth config.
 *
 * Next.js middleware runs on the Edge runtime, which cannot run Prisma's
 * standard client (no TCP sockets, no Node core modules) and should not
 * pull in our Zod-validated server `env` (which requires DATABASE_URL and
 * friends, and throws if they're missing/invalid). This file contains ONLY
 * what's safe to bundle for the Edge: no `providers`, no DB calls in any
 * callback.
 *
 * `apps/web/src/lib/auth.ts` (Node runtime — API routes, Server Components)
 * spreads this config and adds the real providers (Credentials, Facebook)
 * plus the DB-backed `signIn`/`jwt` callbacks that keep role/ban status
 * fresh from the database.
 *
 * `apps/web/src/lib/auth-edge.ts` builds the middleware-only `auth()` from
 * *this* file alone — see DECISIONS.md #25 for the full story (this split
 * was added after hitting a real "Prisma in Edge middleware" crash).
 *
 * Consequence: middleware's view of `role`/`isBanned` reflects whatever was
 * last written into the JWT during a Node-side request (login, or any page/
 * API call, since those go through the full `auth.ts` and its DB-refreshing
 * `jwt` callback). There's a small staleness window between an admin
 * demoting/banning someone and that user's *next* Node-side request — every
 * protected route handler still calls `requireUser()`/`requireAdmin()`
 * (Node runtime, always DB-fresh) as defense in depth, so middleware being
 * slightly stale never grants access to something a route handler would
 * actually allow.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  // Read directly from process.env — NOT from our Zod-validated `env`
  // object — so this file never requires DATABASE_URL etc. to be set just
  // to decode a JWT on the Edge. Auth.js v5 defaults to looking for
  // `AUTH_SECRET`; we use the v4-style `NEXTAUTH_SECRET` name throughout
  // this repo (matches .env.example/README), so it MUST be passed
  // explicitly here or the Edge instance silently fails to verify tokens
  // signed by the Node instance — see DECISIONS.md #25.
  secret: process.env.NEXTAUTH_SECRET,
  // Required for self-hosted/non-Vercel deployments (and some local dev
  // setups) or Auth.js throws "UntrustedHost". Safe to always set.
  trustHost: true,
  pages: {
    signIn: "/login",
    newUser: "/onboarding",
  },
  providers: [],
  callbacks: {
    // No DB access here — just reshape whatever is already on the token
    // (written by the Node-side jwt callback in auth.ts) into the Session
    // shape. Safe to run on every Edge request.
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = (token.role as Role) ?? "VENDOR";
      session.user.isAdmin = token.role === "ADMIN";
      session.user.isBanned = Boolean(token.isBanned);
      session.user.phoneVerified = Boolean(token.phoneVerified);
      session.user.createdAt = (token.createdAt as string) ?? new Date().toISOString();
      session.user.isPro = Boolean(token.isPro);
      return session;
    },
  },
};
