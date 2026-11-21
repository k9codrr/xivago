import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidIndianMobile, toE164IndianMobile } from "@/lib/phone";
import { sendOtp } from "@/lib/otp";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({
  phone: z.string().refine(isValidIndianMobile, "Enter a valid 10-digit Indian mobile number"),
});

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
  const result = await sendOtp(phoneE164);

  if (!result.ok) {
    const status = result.code === "RATE_LIMITED" ? 429 : result.code === "NOT_CONFIGURED" ? 503 : 502;
    return apiError(status, result.code, result.message);
  }

  return NextResponse.json({ ok: true, message: "Code sent via WhatsApp." });
}
