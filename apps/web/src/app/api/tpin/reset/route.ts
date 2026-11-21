import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { checkResetPassword, CreditPaymentError, hashTpin, verifiedPhoneFor } from "@/lib/credit-payment";
import { verifyOtp } from "@/lib/otp";
import { tpinResetSchema } from "@/lib/validation/tpin";

/** Replaces a forgotten T-PIN, given a WhatsApp code or the account password. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = tpinResetSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      const weak = parsed.error.issues.find((issue) => issue.path[0] === "tpin" && issue.code === "custom");
      return weak ? apiError(400, "WEAK_TPIN", weak.message) : apiValidationError(parsed.error);
    }
    const { tpin, code, password } = parsed.data;

    const exists = await prisma.transactionPin.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!exists) return apiError(404, "TPIN_NOT_SET", "You haven't set a T-PIN yet.");

    if (code) {
      const phone = await verifiedPhoneFor(user.id);
      if (!phone) return apiError(409, "NO_VERIFIED_PHONE", "This account has no verified WhatsApp number.");
      const result = await verifyOtp(phone, code);
      if (!result.ok) return apiError(403, result.code, result.message);
    } else {
      await checkResetPassword(user.id, password!);
    }

    await prisma.transactionPin.update({
      where: { userId: user.id },
      data: {
        pinHash: await hashTpin(tpin),
        failedAttempts: 0,
        lockedUntil: null,
        resetFailedAttempts: 0,
        resetLockedUntil: null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("tpin/reset: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not reset your T-PIN.");
  }
}
