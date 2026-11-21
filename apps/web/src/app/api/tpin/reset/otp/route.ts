import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { verifiedPhoneFor } from "@/lib/credit-payment";
import { sendOtp } from "@/lib/otp";

/** Sends a reset code to the user's verified WhatsApp number, never one from the request. */
export async function POST() {
  try {
    const user = await requireUser();
    const phone = await verifiedPhoneFor(user.id);
    if (!phone) return apiError(409, "NO_VERIFIED_PHONE", "This account has no verified WhatsApp number.");

    const result = await sendOtp(phone);
    if (!result.ok) return apiError(result.code === "RATE_LIMITED" ? 429 : 503, result.code, result.message);
    return NextResponse.json({ ok: true, maskedPhone: `••••••${phone.slice(-4)}` });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("tpin/reset/otp: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send the code.");
  }
}
