import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { verifiedPhoneFor } from "@/lib/credit-payment";
import { sendOtp } from "@/lib/otp";
import { phoneChangeSendSchema } from "@/lib/validation/profile";

/** Sends a code to the number the user wants to move to. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = phoneChangeSendSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { phone } = parsed.data;

    if ((await verifiedPhoneFor(user.id)) === phone) {
      return apiError(409, "NO_CHANGE", "This is already your verified number.");
    }

    const result = await sendOtp(phone);
    if (!result.ok) {
      const status = result.code === "RATE_LIMITED" ? 429 : result.code === "NOT_CONFIGURED" ? 503 : 502;
      return apiError(status, result.code, result.message);
    }

    const pin = await prisma.transactionPin.findUnique({ where: { userId: user.id }, select: { id: true } });
    return NextResponse.json({ ok: true, tpinRequired: Boolean(pin) });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/phone/send: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send the code.");
  }
}
