import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";

const TOKEN_TTL_SECONDS = 60;

/**
 * Mints a short-lived (60s) JWT the browser hands to the Socket.IO
 * handshake. This is the bridge between our NextAuth session (an httpOnly
 * cookie, not readable by client JS, and not something apps/realtime
 * should need to know how to decode) and apps/realtime's own auth check --
 * apps/web is the only thing that verifies the real session; apps/realtime
 * only ever verifies tokens apps/web already vouched for. 60s is enough to
 * complete a handshake but useless if it leaks (e.g. into logs).
 */
export async function GET() {
  try {
    const user = await requireUser();

    if (!env.SOCKET_JWT_SECRET) {
      return apiError(503, "REALTIME_NOT_CONFIGURED", "Chat isn't set up on this environment yet.");
    }

    const token = jwt.sign({ sub: user.id, role: user.role }, env.SOCKET_JWT_SECRET, {
      expiresIn: TOKEN_TTL_SECONDS,
    });

    return NextResponse.json({ token, expiresIn: TOKEN_TTL_SECONDS });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("realtime/token: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not start chat.");
  }
}
