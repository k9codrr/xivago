import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma, applyCreditDelta } from "@/lib/db";
import { registerPayloadSchema } from "@/lib/validation/auth";
import { apiError, apiValidationError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { applyReferral, findReferrer, ReferralError, REFERRAL_ERROR_MESSAGES } from "@/lib/referrals";
import { deliverPendingNotifications } from "@/lib/notifications";
import { recordConsent, requestMeta } from "@/lib/consent";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = registerPayloadSchema.safeParse(body);
  if (!parsed.success) return apiValidationError(parsed.error);
  const { name, email, password, role, consentEvents } = parsed.data;
  const referralCode = parsed.data.referralCode?.trim() || null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return apiError(409, "EMAIL_TAKEN", "An account with this email already exists.");
  }

  if (referralCode) {
    const referrer = await findReferrer(referralCode);
    if (!referrer || referrer.isBanned) {
      return apiError(400, "INVALID_REFERRAL_CODE", REFERRAL_ERROR_MESSAGES.INVALID_CODE);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role,
          subscription: { create: {} }, // FREE/ACTIVE by default
        },
        select: { id: true, email: true, name: true, role: true },
      });

      await applyCreditDelta(tx, {
        userId: created.id,
        amount: env.WELCOME_CREDITS,
        type: "GRANT",
        note: "welcome-grant",
      });

      if (referralCode) await applyReferral(tx, created.id, referralCode);

      // acceptedTerms === true and ageConfirmed === true are enforced by registerPayloadSchema.
      await recordConsent(tx, {
        userId: created.id,
        source: "SIGNUP",
        checkboxEvents: consentEvents,
        ageConfirmed: true, // enforced by registerPayloadSchema
        ...requestMeta(req.headers),
      });

      return created;
    });

    if (referralCode) void deliverPendingNotifications(); // inviter's referral-reward push

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof ReferralError) {
      return apiError(400, "INVALID_REFERRAL_CODE", REFERRAL_ERROR_MESSAGES[err.code]);
    }
    console.error("register: failed to create user", err);
    return apiError(500, "INTERNAL_ERROR", "Could not create account. Please try again.");
  }
}
