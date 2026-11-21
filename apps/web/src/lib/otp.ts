import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma, applyCreditDelta, type Prisma } from "@/lib/db";
import { sendTemplateMessage, WHATSAPP_TEMPLATES, WhatsAppApiError } from "@slotbook/whatsapp";
import { getWhatsAppCreds, isWhatsAppConfigured } from "@/lib/whatsapp-creds";
import { env } from "@/lib/env";
import { applyReferral, ReferralError } from "@/lib/referrals";
import { deliverPendingNotifications } from "@/lib/notifications";

const OTP_RATE_LIMIT_PER_HOUR = 3;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 10;

interface OtpPayload {
  purpose: "otp-login";
  codeHash: string;
  expiresAt: string; // ISO
  attempts: number;
  consumed: boolean;
}

function generateOtpCode(): string {
  // Cryptographically random 6-digit code, zero-padded (e.g. "004821").
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, "0");
}

export type SendOtpResult =
  | { ok: true }
  | { ok: false; code: "RATE_LIMITED" | "SEND_FAILED" | "NOT_CONFIGURED"; message: string };

/**
 * Sends a fresh OTP via the "slotbook_otp" AUTHENTICATION template.
 * Rate-limited to 3 requests/hour/phone (section 3.1). Unlike the utility
 * notifications in wa-notifications.ts, OTP delivery is the PRIMARY
 * mechanism here, not a supplementary notification -- so unlike those
 * (whose failures are swallowed so they never block a core flow), a failed
 * OTP send is surfaced to the caller as a real error, because without it
 * the user has no way to log in at all.
 */
export async function sendOtp(phoneE164: string): Promise<SendOtpResult> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, code: "NOT_CONFIGURED", message: "WhatsApp login isn't set up on this environment yet." };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.notificationLog.count({
    where: { toPhone: phoneE164, templateName: WHATSAPP_TEMPLATES.OTP, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= OTP_RATE_LIMIT_PER_HOUR) {
    return { ok: false, code: "RATE_LIMITED", message: "Too many codes requested. Try again in an hour." };
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const payload: OtpPayload = {
    purpose: "otp-login",
    codeHash,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    consumed: false,
  };

  try {
    const result = await sendTemplateMessage(getWhatsAppCreds(), {
      to: phoneE164,
      templateName: WHATSAPP_TEMPLATES.OTP,
      bodyParams: [code],
    });
    await prisma.notificationLog.create({
      data: {
        toPhone: phoneE164,
        templateName: WHATSAPP_TEMPLATES.OTP,
        status: "SENT",
        waMessageId: result.waMessageId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: true };
  } catch (err) {
    await prisma.notificationLog.create({
      data: {
        toPhone: phoneE164,
        templateName: WHATSAPP_TEMPLATES.OTP,
        status: "FAILED",
        payload: payload as unknown as Prisma.InputJsonValue,
        error: err instanceof WhatsAppApiError ? err.message : "Unknown WhatsApp API error",
      },
    });
    console.error("sendOtp: WhatsApp send failed", { phoneE164, err });
    return { ok: false, code: "SEND_FAILED", message: "Could not send the code. Please try again shortly." };
  }
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "INVALID_CODE"; message: string };

/**
 * Verifies a code against the most recent, still-live OTP request for this
 * phone. "5 verify attempts" (section 3.1) is scoped PER CODE (this
 * NotificationLog row), not a global rolling window -- exceeding it
 * invalidates that specific code and the user must request a new one,
 * which is what naturally resets the attempt counter.
 */
export async function verifyOtp(phoneE164: string, code: string): Promise<VerifyOtpResult> {
  const latest = await prisma.notificationLog.findFirst({
    where: { toPhone: phoneE164, templateName: WHATSAPP_TEMPLATES.OTP, status: "SENT" },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) {
    return { ok: false, code: "NOT_FOUND", message: "No code was sent to this number. Request a new one." };
  }

  const payload = latest.payload as unknown as OtpPayload;

  if (payload.consumed) {
    return { ok: false, code: "NOT_FOUND", message: "This code was already used. Request a new one." };
  }
  if (new Date(payload.expiresAt) < new Date()) {
    return { ok: false, code: "EXPIRED", message: "This code has expired. Request a new one." };
  }
  if (payload.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
    return { ok: false, code: "TOO_MANY_ATTEMPTS", message: "Too many incorrect attempts. Request a new code." };
  }

  const valid = await bcrypt.compare(code, payload.codeHash);
  if (!valid) {
    const nextPayload: OtpPayload = { ...payload, attempts: payload.attempts + 1 };
    await prisma.notificationLog.update({
      where: { id: latest.id },
      data: { payload: nextPayload as unknown as Prisma.InputJsonValue },
    });
    const remaining = OTP_MAX_VERIFY_ATTEMPTS - nextPayload.attempts;
    return {
      ok: false,
      code: "INVALID_CODE",
      message: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` : "Incorrect code.",
    };
  }

  const consumedPayload: OtpPayload = { ...payload, consumed: true };
  await prisma.notificationLog.update({
    where: { id: latest.id },
    data: { payload: consumedPayload as unknown as Prisma.InputJsonValue },
  });

  return { ok: true };
}

/**
 * A synthetic, clearly-marked placeholder email for phone-first signups.
 * `User.email` is required + unique in the exact schema (section 5), but
 * WhatsApp OTP login/signup is phone-based and the spec never describes an
 * email-collection step for it -- see DECISIONS.md #37. The user can
 * replace this with a real email later from Settings; nothing in the app
 * currently gates on it being a "real" address.
 */
function syntheticEmailForPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+/, "");
  return `wa+${digits}@users.slotbook.in`;
}

/**
 * Finds the User for this phone, or creates one on first-ever successful
 * OTP verification (phone-first signup, same welcome-credit grant as any
 * other signup path). Mirrors the Facebook-signup pattern in auth.ts: a
 * random unusable passwordHash so credentials login stays off for this
 * account unless the user explicitly sets a password later.
 */
export async function findOrCreateUserByPhone(phoneE164: string, referralCode?: string) {
  // A proven number wins. `phone` alone only counts on accounts with no proven
  // number yet: older rows, from when the profile form saved it unverified.
  const whatsappId = phoneE164.replace(/^\+/, "");
  const existing =
    (await prisma.user.findFirst({ where: { metaLink: { is: { whatsappId } } } })) ??
    (await prisma.user.findFirst({
      where: { phone: phoneE164, OR: [{ metaLink: { is: null } }, { metaLink: { is: { whatsappId: null } } }] },
      orderBy: { createdAt: "asc" },
    }));
  if (existing) {
    await prisma.metaAccountLink.upsert({
      where: { userId: existing.id },
      update: { whatsappId: phoneE164.replace(/^\+/, "") },
      create: { userId: existing.id, whatsappId: phoneE164.replace(/^\+/, "") },
    });
    return existing;
  }

  const randomHash = await bcrypt.hash(crypto.randomUUID(), 12);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: syntheticEmailForPhone(phoneE164),
        name: "xivago user",
        phone: phoneE164,
        passwordHash: randomHash,
        subscription: { create: {} },
        metaLink: { create: { whatsappId: phoneE164.replace(/^\+/, "") } },
      },
    });
    await applyCreditDelta(tx, {
      userId: user.id,
      amount: env.WELCOME_CREDITS,
      type: "GRANT",
      note: "welcome-grant",
    });
    if (referralCode?.trim()) {
      // A bad code must not block signup; applyReferral rejects before writing anything
      try {
        await applyReferral(tx, user.id, referralCode);
      } catch (err) {
        if (!(err instanceof ReferralError)) throw err;
      }
    }
    return user;
  }).finally(() => {
    if (referralCode?.trim()) void deliverPendingNotifications(); // inviter's referral-reward push
  });
}
