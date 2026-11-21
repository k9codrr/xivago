import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { passwordResetCodeEmail, sendEmail, isEmailConfigured, isDeliverableEmail } from "@/lib/email";

/** Same limits as the WhatsApp codes in lib/otp.ts. */
const RATE_LIMIT_PER_HOUR = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const EXPIRY_MINUTES = 10;

export type EmailCodePurpose = "password-reset";

export type SendEmailCodeResult =
  | { ok: true; maskedEmail: string }
  | { ok: false; code: "NOT_CONFIGURED" | "UNDELIVERABLE" | "RATE_LIMITED" | "SEND_FAILED"; message: string };

export type VerifyEmailCodeResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "INVALID_CODE"; message: string };

/** "kanishk@gmail.com" -> "ka•••••@gmail.com" */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

/** The account's own email can receive codes when Resend is set up and it isn't a phone-signup placeholder. */
export function canEmailCodeTo(email: string): boolean {
  return isEmailConfigured() && isDeliverableEmail(email);
}

export async function sendEmailCode(userId: string, purpose: EmailCodePurpose): Promise<SendEmailCodeResult> {
  if (!isEmailConfigured()) return { ok: false, code: "NOT_CONFIGURED", message: "Email isn't set up on this environment yet." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user || !isDeliverableEmail(user.email)) {
    return { ok: false, code: "UNDELIVERABLE", message: "This account has no email address we can send to." };
  }

  const recent = await prisma.emailCode.count({
    where: { userId, purpose, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, code: "RATE_LIMITED", message: "Too many codes requested. Try again in an hour." };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const row = await prisma.emailCode.create({
    data: {
      userId,
      email: user.email,
      purpose,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000),
    },
  });

  const sent = await sendEmail({ to: user.email, ...passwordResetCodeEmail(user.name, code, EXPIRY_MINUTES) });
  if (!sent.ok) {
    await prisma.emailCode.delete({ where: { id: row.id } }); // a code nobody received shouldn't count against the limit
    return { ok: false, code: "SEND_FAILED", message: sent.message };
  }
  return { ok: true, maskedEmail: maskEmail(user.email) };
}

/** Checks a code against the newest live one for this user and purpose; 5 tries per code. */
export async function verifyEmailCode(userId: string, purpose: EmailCodePurpose, code: string): Promise<VerifyEmailCodeResult> {
  const latest = await prisma.emailCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.consumedAt) {
    return { ok: false, code: "NOT_FOUND", message: "No active code. Request a new one." };
  }
  if (latest.expiresAt < new Date()) return { ok: false, code: "EXPIRED", message: "This code has expired. Request a new one." };
  if (latest.attempts >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, code: "TOO_MANY_ATTEMPTS", message: "Too many incorrect attempts. Request a new code." };
  }

  if (!(await bcrypt.compare(code, latest.codeHash))) {
    const { attempts } = await prisma.emailCode.update({
      where: { id: latest.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const left = MAX_VERIFY_ATTEMPTS - attempts;
    return {
      ok: false,
      code: "INVALID_CODE",
      message: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code.",
    };
  }

  // consumedAt: null in the filter makes a code single-use even under concurrent requests
  const { count } = await prisma.emailCode.updateMany({
    where: { id: latest.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count === 0) return { ok: false, code: "NOT_FOUND", message: "This code was already used. Request a new one." };
  return { ok: true };
}
