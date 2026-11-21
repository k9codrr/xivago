import { NextRequest, NextResponse } from "next/server";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { CreditPaymentError } from "@/lib/credit-payment";
import { changeVerifiedPhone } from "@/lib/phone-change";
import { phoneChangeVerifySchema } from "@/lib/validation/profile";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = phoneChangeVerifySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { phone, code, tpin } = parsed.data;

    await changeVerifiedPhone(user.id, phone, code, tpin);
    return NextResponse.json({ ok: true, phone });
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/me/phone/verify: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not change your number.");
  }
}
