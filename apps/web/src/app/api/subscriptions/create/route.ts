import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { createSubscription } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";
import { env, publicEnv } from "@/lib/env";

export async function POST() {
  try {
    const user = await requireUser();

    if (!isRazorpayConfigured() || !env.RAZORPAY_PRO_PLAN_ID) {
      return apiError(503, "SUBSCRIPTIONS_NOT_CONFIGURED", "PRO subscriptions aren't set up on this environment yet.");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, subscription: true },
    });
    if (!dbUser) return apiError(404, "NOT_FOUND", "User not found.");

    if (dbUser.subscription?.plan === "PRO" && dbUser.subscription.status === "ACTIVE") {
      return apiError(409, "ALREADY_PRO", "You're already on PRO.");
    }

    const sub = await createSubscription(getRazorpayCreds(), {
      planId: env.RAZORPAY_PRO_PLAN_ID,
      customerEmail: dbUser.email,
      customerName: dbUser.name,
    });

    // Not PRO yet -- Razorpay Subscriptions require the customer to
    // authorize via Checkout before the first charge; `plan`/`status` only
    // flip once the `subscription.activated` webhook confirms it (section
    // 3.11). We store `razorpaySubId` now purely so the webhook has
    // something to match against.
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: { razorpaySubId: sub.razorpaySubId },
      create: { userId: user.id, razorpaySubId: sub.razorpaySubId },
    });

    return NextResponse.json({
      razorpaySubId: sub.razorpaySubId,
      keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("subscriptions/create: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not start your subscription. Please try again.");
  }
}
