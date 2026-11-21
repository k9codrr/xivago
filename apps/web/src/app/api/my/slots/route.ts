import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/**
 * NOTE: `Bid.paymentId` and `Payment.demandId` are plain unique/nullable
 * columns in the exact schema (section 5) -- neither has an `@relation`
 * attribute, so Prisma does NOT know Bid<->Payment are related at the
 * schema level. `include`/`select` can't traverse them; we fetch Bids and
 * their Payments separately and join in application code instead.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const bids = await prisma.bid.findMany({
      where: { bidderId: user.id },
      select: {
        id: true,
        slot: true,
        createdAt: true,
        paymentId: true,
        demand: {
          select: {
            id: true,
            summary: true,
            status: true,
            timelineEnd: true,
            author: { select: { id: true, name: true, companyName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const paymentIds = bids.map((b) => b.paymentId);
    const payments = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      select: { id: true, amountPaise: true, currency: true, razorpayPaymentId: true, createdAt: true },
    });
    const paymentById = new Map(payments.map((p) => [p.id, p]));

    const slots = bids.map((bid) => ({
      id: bid.id,
      slot: bid.slot,
      createdAt: bid.createdAt,
      demand: bid.demand,
      payment: paymentById.get(bid.paymentId) ?? null,
    }));

    return NextResponse.json({ slots });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("my/slots: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your responses.");
  }
}
