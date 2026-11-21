import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { slotOrderSchema } from "@/lib/validation/payment";
import { createOrder } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";
import { env, publicEnv } from "@/lib/env";
import { calculateSlotPrice } from "@/lib/slot-pricing";

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

    const parsed = slotOrderSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { demandId } = parsed.data;

    const demand = await prisma.demand.findUnique({
      where: { id: demandId },
      select: { id: true, status: true, timelineEnd: true, authorId: true, maxSlots: true, budgetMin: true, budgetMax: true },
    });
    if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");
    if (demand.status !== "OPEN" || demand.timelineEnd <= new Date()) {
      return apiError(409, "DEMAND_UNAVAILABLE", "This request is closed.");
    }
    if (demand.authorId === user.id) {
      return apiError(400, "CANNOT_BID_OWN_DEMAND", "You can't respond to your own request.");
    }

    // Pre-check for a fast, friendly error — the allocation transaction in
    // lib/slot-allocation.ts re-checks this authoritatively at capture time
    // regardless, since a slot could be taken in the gap between this check
    // and the user completing checkout. See DECISIONS.md #26.
    const alreadyHeld = await prisma.bid.findFirst({
      where: { demandId, bidderId: user.id },
      select: { id: true },
    });
    if (alreadyHeld) {
      return apiError(409, "ALREADY_HOLDS_SLOT", "You already have a response spot on this request.");
    }

    const takenCount = await prisma.bid.count({ where: { demandId } });
    if (takenCount >= (demand.maxSlots ?? 3)) {
      return apiError(409, "DEMAND_FULL", "All response spots on this request are filled.");
    }

    const { paise: slotPricePaise } = calculateSlotPrice(demand.budgetMax, demand.budgetMin);

    const receipt = `slot_${demandId}_${user.id}_${Date.now()}`.slice(0, 40); // Razorpay caps receipt length at 40
    const order = await createOrder(getRazorpayCreds(), {
      amountPaise: slotPricePaise,
      currency: "INR",
      receipt,
      notes: { demandId, userId: user.id, type: "SLOT" },
    });

    await prisma.payment.create({
      data: {
        userId: user.id,
        type: "SLOT",
        status: "CREATED",
        amountPaise: order.amountPaise,
        currency: order.currency,
        razorpayOrderId: order.razorpayOrderId,
        demandId,
        slotCount: 1, // see DECISIONS.md #26
      },
    });

    return NextResponse.json({
      razorpayOrderId: order.razorpayOrderId,
      keyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amountPaise: order.amountPaise,
      currency: order.currency,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("payments/slot-order: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not start checkout. Please try again.");
  }
}
