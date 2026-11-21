import { NextResponse } from "next/server";
import { prisma, type Prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

const PAGE_SIZE = 50;

/**
 * Admin Razorpay payment lookup. Searches the whole payments table on the
 * server: `q` matches any part of the payment ID, customer ID, post ID,
 * Razorpay order/payment ID, customer email or name. Paged via `cursor`.
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const params = new URL(req.url).searchParams;
    const q = params.get("q")?.trim() ?? "";
    const cursor = params.get("cursor") || undefined;

    const refundableOnly = params.get("refundable") === "1";

    const contains = { contains: q, mode: "insensitive" } as const;
    const search: Prisma.PaymentWhereInput = q
      ? {
          OR: [
            { id: contains },
            { userId: contains },
            { demandId: contains },
            { razorpayOrderId: contains },
            { razorpayPaymentId: contains },
            { razorpayRefundId: contains },
            { user: { email: contains } },
            { user: { name: contains } },
          ],
        }
      : {};
    // Same rule as the Refund button: captured credit top-ups not refunded yet.
    const where: Prisma.PaymentWhereInput = refundableOnly
      ? { AND: [search, { type: "CREDITS", status: "CAPTURED", refundedAt: null, razorpayPaymentId: { not: null } }] }
      : search;

    const rows = await prisma.payment.findMany({
      where,
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > PAGE_SIZE;
    const payments = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const total = await prisma.payment.count({ where });

    return NextResponse.json({ payments, total, nextCursor: hasMore ? payments[payments.length - 1]!.id : null });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/payments GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load payments.");
  }
}
