import { NextRequest, NextResponse } from "next/server";
import { apiError, apiValidationError } from "@/lib/api-response";
import { passwordResetSendSchema } from "@/lib/validation/auth";
import { findUserForReset, sendResetCode } from "@/lib/password-reset";

/**
 * POST /api/auth/password-reset/send  { identifier: email | mobile, channel?: "email" | "whatsapp" }
 * "Forgot password" from the login screen: sends a 6-digit code by email
 * (Resend) or to the verified WhatsApp number. 3 codes/hour per channel.
 */
export async function POST(req: NextRequest) {
  const parsed = passwordResetSendSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { identifier, channel } = parsed.data;

  const user = await findUserForReset(identifier);
  if (!user || user.isBanned) {
    return apiError(404, "NO_RESET_ROUTE", "We couldn't find an account for that email or mobile number.");
  }
  // Typing a phone number means "send it there"; typing an email prefers email
  const preferred = channel ?? (identifier.includes("@") ? "email" : "whatsapp");
  const result = await sendResetCode(user, preferred);
  if (!result.ok) return apiError(result.status, result.code, result.message);
  return NextResponse.json({
    ok: true,
    channel: result.channel,
    maskedTarget: result.maskedTarget,
    channels: result.channels,
  });
}
