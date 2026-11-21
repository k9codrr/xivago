import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { getOrCreateReferralCode, REFERRAL_REDEEM_WINDOW_MS } from "@/lib/referrals";

/** Refer & earn summary: the user's code, who joined with it, and whether they can still enter a code themselves. */
export async function GET() {
  try {
    const user = await requireUser();
    const [code, me, referrals, earned] = await Promise.all([
      getOrCreateReferralCode(user.id),
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, referredById: true } }),
      prisma.user.findMany({
        where: { referredById: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, name: true, avatarUrl: true, createdAt: true },
      }),
      prisma.creditTransaction.aggregate({
        where: { userId: user.id, note: { startsWith: "referral-reward:" } },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      code,
      rewardCredits: env.REFERRAL_REWARD_CREDITS,
      welcomeCredits: env.REFERRAL_WELCOME_CREDITS,
      referrals,
      earnedCredits: earned._sum.amount ?? 0,
      canRedeem: !me.referredById && Date.now() - me.createdAt.getTime() <= REFERRAL_REDEEM_WINDOW_MS,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("referrals GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your referrals.");
  }
}
