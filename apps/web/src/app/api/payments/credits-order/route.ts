import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { creditsOrderSchema } from "@/lib/validation/payment";
import { createOrder } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";
import { publicEnv } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    if (!isRazorpayConfigured()) {
      return apiError(503, "PAYMENTS_NOT_CONFIGURED", "Payments aren't set up on this environment yet.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const parsed = creditsOrderSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { credits } = parsed.data;

    // 1 credit = 1 INR = 100 paise
    const amountPaise = credits * 100;
    const receipt = `cred_${user.id}_${Date.now()}`.slice(0, 40);

    const order = await createOrder(getRazorpayCreds(), {
      amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: user.id,
        type: "CREDITS",
        credits: String(credits),
      },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        type: "CREDITS",
        status: "CREATED",
        amountPaise: order.amountPaise,
        currency: order.currency,
        razorpayOrderId: order.razorpayOrderId,
        slotCount: credits, // store credits count for quick access
      },
    });

    return NextResponse.json({
      razorpayOrderId: order.razorpayOrderId,
      keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountPaise: order.amountPaise,
      currency: order.currency,
      credits,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("payments/credits-order: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not start credit checkout. Please try again.");
  }
}
