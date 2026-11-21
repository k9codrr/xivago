import "server-only";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolve the current session and throw if there isn't one, or if the
 * account has been banned. Route handlers should catch `UnauthorizedError`
 * and map it to `ApiErrors.unauthorized()`.
 */
export async function requireUser(): Promise<NonNullable<Session["user"]>> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  if (session.user.isBanned) throw new ForbiddenError("ACCOUNT_BANNED");
  return session.user;
}

/**
 * Same as `requireUser` but additionally asserts ADMIN role. Used on every
 * /api/admin/* route and every /admin/* page per §3.12 ("guarded on every
 * page + API").
 */
export async function requireAdmin(): Promise<NonNullable<Session["user"]>> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError("ADMIN_ONLY");
  return user;
}

/** Best-effort session fetch for pages that render differently when
 * logged in vs. out, without hard-requiring auth (e.g. the public feed). */
export async function getOptionalUser(): Promise<Session["user"] | null> {
  const session = await auth();
  return session?.user ?? null;
}
