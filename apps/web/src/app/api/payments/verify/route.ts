import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { paymentVerifySchema } from "@/lib/validation/payment";
import { verifyPaymentSignature } from "@slotbook/payments";
import { getRazorpayCreds } from "@/lib/razorpay-creds";
import { captureSlotPayment } from "@/lib/slot-allocation";
import { notifyCreditsPurchased } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const parsed = paymentVerifySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

    const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
    if (!payment) return apiError(404, "NOT_FOUND", "No payment matches this order.");
    if (payment.userId !== user.id) {
      return apiError(403, "FORBIDDEN", "This payment doesn't belong to you.");
    }

    // Section 3.4/10: HMAC-SHA256 constant-time signature check BEFORE
    // anything else touches the database or Razorpay's refund API.
    const validSignature = verifyPaymentSignature(
      getRazorpayCreds().keySecret,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    if (!validSignature) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "SIGNATURE_MISMATCH" },
      });
      return apiError(400, "SIGNATURE_MISMATCH", "Payment verification failed.");
    }

    if (payment.type === "CREDITS") {
      if (payment.status === "CAPTURED") {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { creditBalance: true },
        });
        return NextResponse.json({
          type: "CREDITS",
          alreadyCaptured: true,
          balance: dbUser?.creditBalance ?? 0,
          creditsAdded: payment.slotCount ?? Math.floor(payment.amountPaise / 100),
        });
      }

      const creditsToAdd = payment.slotCount ?? Math.floor(payment.amountPaise / 100);

      const { balance } = await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "CAPTURED",
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
          },
        });

        return applyCreditDelta(tx, {
          userId: user.id,
          amount: creditsToAdd,
          type: "PURCHASE",
          note: "razorpay-credit-topup",
        });
      });

      void notifyCreditsPurchased(user.id, creditsToAdd, balance, payment.id);

      return NextResponse.json({
        type: "CREDITS",
        balance,
        creditsAdded: creditsToAdd,
      });
    }

    const result = await captureSlotPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!result.ok) {
      const status = result.code === "PAYMENT_NOT_FOUND" ? 404 : result.refunded ? 409 : 500;
      return apiError(
        status,
        result.code,
        result.refunded
          ? `${result.message} Your payment has been refunded.`
          : `${result.message} If you were charged, contact support -- we're on it.`,
      );
    }

    return NextResponse.json({
      bidId: result.bidId,
      slot: result.slot,
      conversationId: result.conversationId,
      demandFilled: result.demandFilled,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("payments/verify: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not verify your payment. Please try again.");
  }
}
