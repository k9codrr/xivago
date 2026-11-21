import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { passwordChangeSchema } from "@/lib/validation/auth";
import { passwordMatches, resetChannelsFor, setPassword, verifyResetCode } from "@/lib/password-reset";

/** GET /api/users/me/password -- which channels can deliver a reset code: { channels: { email, whatsapp } }. */
export async function GET() {
  try {
    const session = await requireUser();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { id: true, email: true } });
    return NextResponse.json({ channels: await resetChannelsFor(user) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    throw err;
  }
}

/**
 * POST /api/users/me/password  { currentPassword } | { channel, code }, plus { password }
 * Change the password knowing the current one, or reset it with an emailed / WhatsApp code.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = passwordChangeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { currentPassword, channel, code, password } = parsed.data;

    if (code) {
      const result = await verifyResetCode(user.id, channel, code);
      if (!result.ok) return apiError(403, result.code, result.message);
    } else if (!(await passwordMatches(user.id, currentPassword!))) {
      return apiError(403, "PASSWORD_INVALID", "Your current password is incorrect.");
    }

    await setPassword(user.id, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/password: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update your password.");
  }
}
