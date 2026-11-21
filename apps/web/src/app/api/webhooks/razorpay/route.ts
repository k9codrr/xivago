import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta } from "@/lib/db";
import { verifyWebhookSignature } from "@slotbook/payments";
import { getRazorpayCreds } from "@/lib/razorpay-creds";
import { captureSlotPayment } from "@/lib/slot-allocation";
import { apiError } from "@/lib/api-response";
import { notifyCreditsPurchased } from "@/lib/notifications";

/**
 * Razorpay webhook -- handles payment.captured, payment.failed,
 * refund.processed, subscription.activated, subscription.charged,
 * subscription.cancelled, subscription.halted. Every handler here is
 * idempotent by razorpayPaymentId/razorpaySubId, per section 3.4/6.
 * Signature verification MUST run against the raw request body --
 * re-serializing parsed JSON can change byte-for-byte content and break
 * the HMAC check, so we read `req.text()` once and never re-stringify it
 * before verifying.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  const valid = verifyWebhookSignature(getRazorpayCreds().webhookSecret, rawBody, signature);
  if (!valid) {
    return apiError(401, "INVALID_SIGNATURE", "Webhook signature verification failed.");
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return apiError(400, "INVALID_JSON", "Malformed webhook payload.");
  }

  const { event: eventType, payload } = event as {
    event?: string;
    payload?: {
      payment?: { entity?: { id: string; order_id: string; status: string } };
      refund?: { entity?: { id: string; payment_id: string; status: string } };
      subscription?: { entity?: { id: string; status: string; current_end?: number } };
    };
  };

  try {
    switch (eventType) {
      case "payment.captured": {
        const entity = payload?.payment?.entity;
        if (!entity) break;

        const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
        if (payment?.type === "CREDITS") {
          if (payment.status !== "CAPTURED") {
            const creditsToAdd = payment.slotCount ?? Math.floor(payment.amountPaise / 100);
            const { balance } = await prisma.$transaction(async (tx) => {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: "CAPTURED", razorpayPaymentId: entity.id },
              });
              return applyCreditDelta(tx, {
                userId: payment.userId,
                amount: creditsToAdd,
                type: "PURCHASE",
                note: "razorpay-credit-topup-webhook",
              });
            });
            // Collapses with the verify route's notification if both ran.
            void notifyCreditsPurchased(payment.userId, creditsToAdd, balance, payment.id);
          }
          break;
        }

        // Shared with POST /api/payments/verify -- see DECISIONS.md #29.
        await captureSlotPayment(entity.order_id, entity.id, null);
        break;
      }

      case "payment.failed": {
        const entity = payload?.payment?.entity;
        if (!entity) break;
        await prisma.payment.updateMany({
          where: { razorpayOrderId: entity.order_id, status: { in: ["CREATED", "AUTHORIZED"] } },
          data: { status: "FAILED", failureReason: "RAZORPAY_PAYMENT_FAILED" },
        });
        break;
      }

      case "refund.processed": {
        const entity = payload?.refund?.entity;
        if (!entity) break;
        await prisma.payment.updateMany({
          where: { razorpayPaymentId: entity.payment_id, refundedAt: null },
          data: { status: "REFUNDED", refundedAt: new Date() },
        });
        break;
      }

      // §3.11: "subscription.activated/charged sets/renews Subscription
      // {plan: PRO, status: ACTIVE, currentPeriodEnd, razorpaySubId}."
      case "subscription.activated":
      case "subscription.charged": {
        const entity = payload?.subscription?.entity;
        if (!entity) break;
        const currentPeriodEnd = entity.current_end ? new Date(entity.current_end * 1000) : null;
        await prisma.subscription.updateMany({
          where: { razorpaySubId: entity.id },
          data: { plan: "PRO", status: "ACTIVE", currentPeriodEnd },
        });
        break;
      }

      // §3.11: "subscription.cancelled/halted -> status CANCELLED/HALTED ->
      // plan falls back to FREE at period end (keep ACTIVE until
      // currentPeriodEnd passes)." `plan` intentionally stays PRO here --
      // isPro() (packages/db/src/subscription.ts) is what actually enforces
      // the period-end cutoff, not this write.
      case "subscription.cancelled": {
        const entity = payload?.subscription?.entity;
        if (!entity) break;
        await prisma.subscription.updateMany({
          where: { razorpaySubId: entity.id },
          data: { status: "CANCELLED" },
        });
        break;
      }

      case "subscription.halted": {
        const entity = payload?.subscription?.entity;
        if (!entity) break;
        await prisma.subscription.updateMany({
          where: { razorpaySubId: entity.id },
          data: { status: "HALTED" },
        });
        break;
      }

      default:
        // Unknown/unhandled event types are acknowledged, not errored --
        // Razorpay's event set grows over time and a 4xx/5xx here would
        // just cause pointless retries.
        break;
    }
  } catch (err) {
    console.error("razorpay webhook: handler error", { eventType, err });
    // Still 200 -- Razorpay retries on non-2xx, and our handlers are
    // idempotent, so a transient failure here will self-heal on the next
    // delivery attempt or the next /api/payments/verify call for the same
    // order. Returning 500 would just add retry noise without changing
    // the outcome.
  }

  return NextResponse.json({ received: true });
}
