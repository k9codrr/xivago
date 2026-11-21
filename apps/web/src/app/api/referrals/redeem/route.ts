import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { redeemReferralLater, ReferralError, REFERRAL_ERROR_MESSAGES } from "@/lib/referrals";

const bodySchema = z.object({ code: z.string().trim().min(1).max(20) });

/** Enter a referral code after signup (for signup paths with no code field, e.g. Facebook). */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const user = await requireUser();
    await redeemReferralLater(user.id, parsed.data.code);
    return NextResponse.json({ ok: true, welcomeCredits: env.REFERRAL_WELCOME_CREDITS });
  } catch (err) {
    if (err instanceof ReferralError) return apiError(400, err.code, REFERRAL_ERROR_MESSAGES[err.code]);
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("referrals/redeem: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not apply this referral code.");
  }
}
