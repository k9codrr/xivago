import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { cancelSubscription } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";

export async function POST() {
  try {
    const user = await requireUser();

    if (!isRazorpayConfigured()) {
      return apiError(503, "SUBSCRIPTIONS_NOT_CONFIGURED", "PRO subscriptions aren't set up on this environment yet.");
    }

    const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!subscription?.razorpaySubId) {
      return apiError(404, "NOT_SUBSCRIBED", "You don't have an active subscription to cancel.");
    }

    await cancelSubscription(getRazorpayCreds(), subscription.razorpaySubId, true);

    // Optimistic local update -- the `subscription.cancelled` webhook will
    // also fire and apply the same change idempotently; updating here too
    // means the UI reflects the cancellation immediately rather than
    // waiting on webhook latency.
    const updated = await prisma.subscription.update({
      where: { userId: user.id },
      data: { status: "CANCELLED" },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });

    return NextResponse.json({
      subscription: updated,
      message: updated.currentPeriodEnd
        ? `PRO stays active until ${updated.currentPeriodEnd.toLocaleDateString("en-IN", { dateStyle: "medium" })}.`
        : "Subscription cancelled.",
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("subscriptions/cancel: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not cancel your subscription. Please try again.");
  }
}
