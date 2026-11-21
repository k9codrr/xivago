import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { isValidIndianMobile, toE164IndianMobile } from "@/lib/phone";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({
  phone: z.string().refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: "No code was sent to this number. Request a new one.",
  EXPIRED: "This code has expired. Request a new one.",
  TOO_MANY_ATTEMPTS: "Too many incorrect attempts. Request a new code.",
  INVALID_CODE: "Incorrect code.",
  ACCOUNT_BANNED: "This account has been suspended. Contact support.",
};

/**
 * Verification AND session issuance both happen here, via NextAuth's own
 * server-side `signIn()` calling the "whatsapp-otp" Credentials provider
 * (lib/auth.ts), whose `authorize()` runs the real check
 * (lib/otp.ts#verifyOtp). This route exists because §6 lists a literal
 * `/verify` path; the actual verification logic lives in exactly one place
 * (the provider), not duplicated here -- this route is a thin adapter that
 * translates NextAuth's `AuthError` into our standard
 * `{error:{code,message}}` shape and returns `{ok:true}` on success so the
 * client knows to redirect.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);

  const phoneE164 = toE164IndianMobile(parsed.data.phone);

  try {
    await signIn("whatsapp-otp", {
      phone: phoneE164,
      code: parsed.data.code,
      redirect: false,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = err.type === "CredentialsSignin" ? (err.cause as { err?: Error })?.err?.message ?? "INVALID_CODE" : err.type;
      const message = ERROR_MESSAGES[code as string] ?? "Could not verify this code.";
      return apiError(400, code as string, message);
    }
    console.error("whatsapp-otp/verify: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not verify this code. Please try again.");
  }
}
