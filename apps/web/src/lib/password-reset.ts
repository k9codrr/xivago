import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { isValidIndianMobile, toE164IndianMobile } from "@/lib/phone";
import { verifiedPhoneFor } from "@/lib/credit-payment";
import { sendOtp, verifyOtp } from "@/lib/otp";
import { canEmailCodeTo, sendEmailCode, verifyEmailCode } from "@/lib/email-otp";

/**
 * Password resets are proven with a 6-digit code sent either to the account's
 * email (through Resend, lib/email-otp.ts) or to its verified WhatsApp number
 * (lib/otp.ts). Accounts with neither can't reset and are told to log in with
 * WhatsApp instead.
 */

type ResetUser = { id: string; email: string; isBanned: boolean };
const RESET_SELECT = { id: true, email: true, isBanned: true } as const;

/** Finds the account by email, or by a verified WhatsApp number. */
export async function findUserForReset(identifier: string): Promise<ResetUser | null> {
  const raw = identifier.trim();
  if (raw.includes("@")) {
    return prisma.user.findUnique({ where: { email: raw.toLowerCase() }, select: RESET_SELECT });
  }
  if (!isValidIndianMobile(raw)) return null;
  const whatsappId = toE164IndianMobile(raw).replace(/^\+/, "");
  return prisma.user.findFirst({
    where: { metaLink: { is: { whatsappId } } },
    select: RESET_SELECT,
  });
}

export const maskPhone = (phone: string) => `+91 ••••••${phone.slice(-4)}`;

export { verifiedPhoneFor };

export async function setPassword(userId: string, password: string) {
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(password, 12) } });
}

export async function passwordMatches(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return Boolean(user?.passwordHash) && bcrypt.compare(password, user!.passwordHash);
}

// ── Sending / checking codes on either channel ──────────────────────────────

export type ResetChannel = "email" | "whatsapp";

export interface ChannelOptions {
  email: boolean;
  whatsapp: boolean;
}

/** Which channels can reach this account right now. */
export async function resetChannelsFor(user: { id: string; email: string }): Promise<ChannelOptions> {
  return { email: canEmailCodeTo(user.email), whatsapp: Boolean(await verifiedPhoneFor(user.id)) };
}

export type SendResetCodeResult =
  | { ok: true; channel: ResetChannel; maskedTarget: string; channels: ChannelOptions }
  | { ok: false; status: number; code: string; message: string };

/**
 * Sends a reset code on `preferred` if it can reach the account, otherwise on
 * whichever channel can. Without a preference, email goes first.
 */
export async function sendResetCode(
  user: { id: string; email: string },
  preferred: ResetChannel | undefined,
): Promise<SendResetCodeResult> {
  const channels = await resetChannelsFor(user);
  const order: ResetChannel[] = preferred === "whatsapp" ? ["whatsapp", "email"] : ["email", "whatsapp"];
  const channel = order.find((c) => channels[c]);
  if (!channel) {
    return {
      ok: false,
      status: 404,
      code: "NO_RESET_ROUTE",
      message:
        "This account has no email or verified WhatsApp number we can send a code to. Try logging in with WhatsApp.",
    };
  }

  if (channel === "email") {
    const r = await sendEmailCode(user.id, "password-reset");
    if (!r.ok) return { ok: false, status: r.code === "RATE_LIMITED" ? 429 : 502, code: r.code, message: r.message };
    return { ok: true, channel, maskedTarget: r.maskedEmail, channels };
  }

  const phone = (await verifiedPhoneFor(user.id))!;
  const r = await sendOtp(phone);
  if (!r.ok) {
    const status = r.code === "RATE_LIMITED" ? 429 : r.code === "NOT_CONFIGURED" ? 503 : 502;
    return { ok: false, status, code: r.code, message: r.message };
  }
  return { ok: true, channel, maskedTarget: maskPhone(phone), channels };
}

export async function verifyResetCode(
  userId: string,
  channel: ResetChannel,
  code: string,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  if (channel === "email") return verifyEmailCode(userId, "password-reset", code);
  const phone = await verifiedPhoneFor(userId);
  if (!phone) return { ok: false, code: "NO_VERIFIED_PHONE", message: "This account has no verified WhatsApp number." };
  return verifyOtp(phone, code);
}
