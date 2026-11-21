import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** The signed-in user's credit top-ups, with any refund and the latest refund request on each. */
export async function GET() {
  try {
    const user = await requireUser();
    const [payments, profile] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: user.id, type: "CREDITS", status: { in: ["CAPTURED", "REFUNDED"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          amountPaise: true,
          slotCount: true,
          createdAt: true,
          refundedAt: true,
          refundAmountPaise: true,
          refundDeductionPaise: true,
          refundCredits: true,
          refundSpeed: true,
          refundRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, reason: true, adminNote: true, createdAt: true, decidedAt: true },
          },
        },
      }),
      prisma.user.findUnique({ where: { id: user.id }, select: { creditBalance: true } }),
    ]);

    return NextResponse.json({
      creditBalance: profile?.creditBalance ?? 0,
      topUps: payments.map(({ refundRequests, slotCount, ...p }) => ({
        ...p,
        credits: slotCount ?? Math.floor(p.amountPaise / 100),
        request: refundRequests[0] ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("payments/refunds GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your top-ups.");
  }
}
