import { NextRequest, NextResponse } from "next/server";
import { apiError, apiValidationError } from "@/lib/api-response";
import { passwordResetConfirmSchema } from "@/lib/validation/auth";
import { findUserForReset, setPassword, verifyResetCode } from "@/lib/password-reset";

/**
 * POST /api/auth/password-reset/confirm  { identifier, channel, code, password }
 * Checks the code (5 tries per code) and sets the new password.
 */
export async function POST(req: NextRequest) {
  const parsed = passwordResetConfirmSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { identifier, channel, code, password } = parsed.data;

  const user = await findUserForReset(identifier);
  if (!user || user.isBanned) return apiError(404, "NO_RESET_ROUTE", "Request a new code and try again.");

  const result = await verifyResetCode(user.id, channel, code);
  if (!result.ok) return apiError(403, result.code, result.message);

  await setPassword(user.id, password);
  return NextResponse.json({ ok: true });
}
