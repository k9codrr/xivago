import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { findReferrer } from "@/lib/referrals";

/** Public: lets signup forms confirm a referral code before the account exists. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code") ?? "";
  const referrer = code.length <= 20 ? await findReferrer(code) : null;
  if (!referrer || referrer.isBanned) return NextResponse.json({ valid: false });
  return NextResponse.json({
    valid: true,
    referrerName: referrer.name,
    welcomeCredits: env.REFERRAL_WELCOME_CREDITS,
  });
}
