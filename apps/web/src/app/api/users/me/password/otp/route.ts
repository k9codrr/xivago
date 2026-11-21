import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { sendResetCode } from "@/lib/password-reset";
import { codeChannelSchema } from "@/lib/validation/auth";

const bodySchema = z.object({ channel: codeChannelSchema.optional() });

/** POST /api/users/me/password/otp  { channel? } -- sends a reset code to the signed-in user by email or WhatsApp. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireUser();
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Unknown channel.");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.id }, select: { id: true, email: true } });

    const result = await sendResetCode(user, parsed.data.channel);
    if (!result.ok) return apiError(result.status, result.code, result.message);
    return NextResponse.json({ ok: true, channel: result.channel, maskedTarget: result.maskedTarget });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/password/otp: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send the code.");
  }
}
