import "server-only";
import crypto from "node:crypto";
import { prisma, applyCreditDelta } from "@/lib/db";
import { env } from "@/lib/env";
import { recordReferralReward, deliverPendingNotifications } from "@/lib/notifications";
import type { Prisma } from "@slotbook/db";

/** Accounts younger than this can still enter a referral code after signing up (e.g. Facebook signups). */
export const REFERRAL_REDEEM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I lookalikes

export class ReferralError extends Error {
  constructor(public code: "INVALID_CODE" | "OWN_CODE" | "ALREADY_REFERRED" | "WINDOW_CLOSED") {
    super(code);
    this.name = "ReferralError";
  }
}

export function normalizeReferralCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function randomCode(name: string): string {
  const prefix = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "XIVA";
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return prefix + suffix;
}

/** Returns the user's referral code, generating and saving one on first use. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, referralCode: true } });
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; ; attempt++) {
    try {
      // Conditional on still being null, so a concurrent first load can't overwrite a code already shared
      await prisma.user.updateMany({
        where: { id: userId, referralCode: null },
        data: { referralCode: randomCode(user.name) },
      });
    } catch (err) {
      // Unique clash with another user's code -> retry with a fresh one
      if (attempt >= 4) throw err;
      continue;
    }
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (saved.referralCode) return saved.referralCode;
  }
}

export async function findReferrer(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  return prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true, name: true, avatarUrl: true, isBanned: true },
  });
}

/**
 * Links `newUserId` to the owner of `code` and pays both sides: the inviter
 * gets REFERRAL_REWARD_CREDITS, the new user REFERRAL_WELCOME_CREDITS. Runs
 * inside the caller's transaction so a signup and its referral commit together.
 */
export async function applyReferral(tx: Prisma.TransactionClient, newUserId: string, code: string) {
  const normalized = normalizeReferralCode(code);
  const referrer = normalized
    ? await tx.user.findUnique({ where: { referralCode: normalized }, select: { id: true, isBanned: true } })
    : null;
  if (!referrer || referrer.isBanned) throw new ReferralError("INVALID_CODE");
  if (referrer.id === newUserId) throw new ReferralError("OWN_CODE");

  // Conditional update so two concurrent redeems can't both pay out
  const linked = await tx.user.updateMany({
    where: { id: newUserId, referredById: null },
    data: { referredById: referrer.id },
  });
  if (linked.count === 0) throw new ReferralError("ALREADY_REFERRED");

  if (env.REFERRAL_REWARD_CREDITS > 0) {
    await applyCreditDelta(tx, {
      userId: referrer.id,
      amount: env.REFERRAL_REWARD_CREDITS,
      type: "GRANT",
      note: `referral-reward:${newUserId}`,
    });
    // Row commits with the referral; callers push it after commit.
    await recordReferralReward(tx, referrer.id, newUserId, env.REFERRAL_REWARD_CREDITS);
  }
  if (env.REFERRAL_WELCOME_CREDITS > 0) {
    await applyCreditDelta(tx, {
      userId: newUserId,
      amount: env.REFERRAL_WELCOME_CREDITS,
      type: "GRANT",
      note: "referral-welcome",
    });
  }
}

/** Same as applyReferral, but for a code entered after signup: only allowed on young accounts. */
export async function redeemReferralLater(userId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    if (Date.now() - user.createdAt.getTime() > REFERRAL_REDEEM_WINDOW_MS) throw new ReferralError("WINDOW_CLOSED");
    await applyReferral(tx, userId, code);
  }).finally(() => {
    void deliverPendingNotifications();
  });
}

export const REFERRAL_ERROR_MESSAGES: Record<ReferralError["code"], string> = {
  INVALID_CODE: "That referral code doesn't exist.",
  OWN_CODE: "You can't use your own referral code.",
  ALREADY_REFERRED: "A referral code has already been applied to this account.",
  WINDOW_CLOSED: "Referral codes can only be added within 7 days of signing up.",
};
