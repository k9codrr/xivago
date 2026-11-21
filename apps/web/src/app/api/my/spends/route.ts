import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const VIDEO_URL = /\.(mp4|webm|mov)(\?.*)?$/i;

/**
 * Every slot the user has bought, with the day it was bought and the
 * demand's cover photo, for the /spends calendar. Bid<->Payment have no
 * Prisma relation (see /api/my/slots), so payments are joined in code.
 */
export async function GET() {
  try {
    const user = await requireUser();

    const bids = await prisma.bid.findMany({
      where: { bidderId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slot: true,
        createdAt: true,
        paymentId: true,
        demand: { select: { id: true, summary: true, categoryName: true, mediaUrls: true } },
      },
    });

    const payments = await prisma.payment.findMany({
      where: { id: { in: bids.map((b) => b.paymentId) } },
      select: { id: true, amountPaise: true, razorpayOrderId: true },
    });
    const paymentById = new Map(payments.map((p) => [p.id, p]));

    const purchases = bids.map((b) => {
      const payment = paymentById.get(b.paymentId);
      return {
        id: b.id,
        slot: b.slot,
        boughtAt: b.createdAt,
        amountPaise: payment?.amountPaise ?? 0,
        // Credit-paid slots get a synthetic `cred_` order id (see /api/demands/[id]/slots)
        paidWith: payment?.razorpayOrderId.startsWith("cred_") ? "CREDITS" : "CASH",
        demand: {
          id: b.demand.id,
          summary: b.demand.summary,
          categoryName: b.demand.categoryName,
          coverUrl: b.demand.mediaUrls.find((u) => !VIDEO_URL.test(u) && !u.includes("/videos/")) ?? null,
        },
      };
    });

    return NextResponse.json({ purchases });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("my/spends: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your spends.");
  }
}
