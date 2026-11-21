import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

/**
 * The ONLY `auth()` that middleware.ts is allowed to import. Built from
 * `authConfig` alone — no providers, no Prisma, no full server `env` — so
 * it's safe to bundle for the Edge runtime. See auth.config.ts and
 * DECISIONS.md #25.
 */
export const { auth } = NextAuth(authConfig);
