import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** GET — every open refund request, oldest first (never cut short). `?count=1` returns just the number. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    if (new URL(req.url).searchParams.get("count") === "1") {
      return NextResponse.json({ count: await prisma.refundRequest.count({ where: { status: "PENDING" } }) });
    }
    const requests = await prisma.refundRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        user: { select: { creditBalance: true } },
        payment: {
          select: {
            id: true,
            type: true,
            status: true,
            amountPaise: true,
            currency: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            demandId: true,
            slotCount: true,
            failureReason: true,
            refundedAt: true,
            refundAmountPaise: true,
            refundDeductionPaise: true,
            refundCredits: true,
            razorpayRefundId: true,
            refundSpeed: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    return NextResponse.json({ requests });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/refund-requests GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load refund requests.");
  }
}
