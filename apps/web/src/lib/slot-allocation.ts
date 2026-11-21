import "server-only";
import { prisma } from "@/lib/db";
import { createRefund } from "@slotbook/payments";
import { getRazorpayCreds } from "@/lib/razorpay-creds";
import { notifySlotPurchased } from "@/lib/wa-notifications";
import type { Prisma } from "@slotbook/db";

export type CaptureResult =
  | { ok: true; bidId: string; slot: number; conversationId: string; demandFilled: boolean; alreadyCaptured: boolean }
  | { ok: false; code: string; message: string; refunded: boolean };

/**
 * THE ONLY function allowed to turn a captured SLOT payment into a `Bid`.
 * Called from both `POST /api/payments/verify` (client-initiated) and the
 * `payment.captured` webhook handler (server-initiated) — per §3.4's own
 * note that "webhook may beat the verify call," both paths MUST converge
 * on identical, idempotent behavior. See DECISIONS.md #26 and #29.
 *
 * Contract:
 *  - `razorpayOrderId` identifies the `Payment` row (unique).
 *  - Idempotent: if this payment has already been captured (a `Bid`
 *    already references it), returns the existing result without doing
 *    anything else — no re-charge, no re-allocate, no double refund.
 *  - Atomic: demand re-validation, slot allocation, `Bid` + `Conversation`
 *    creation, `Payment` status update, and the OPEN->FILLED transition all
 *    happen in ONE interactive transaction (§3.4 step 4).
 *  - Never leaves money taken without a slot: if allocation fails inside
 *    the transaction (demand expired/filled/already-held mid-flight), the
 *    transaction still commits the FAILED status, and a refund is issued
 *    immediately afterward (§3.4 step 5).
 */
export async function captureSlotPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string | null,
): Promise<CaptureResult> {
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });

  if (!payment) {
    return { ok: false, code: "PAYMENT_NOT_FOUND", message: "No payment matches this order.", refunded: false };
  }
  if (payment.type !== "SLOT" || !payment.demandId) {
    return { ok: false, code: "NOT_A_SLOT_PAYMENT", message: "This payment isn't for a response spot.", refunded: false };
  }

  // -- Idempotency: already captured? --------------------------------------
  if (payment.status === "CAPTURED") {
    const existingBid = await prisma.bid.findUnique({ where: { paymentId: payment.id } });
    if (existingBid) {
      const demand = await prisma.demand.findUnique({
        where: { id: payment.demandId },
        select: { status: true, authorId: true },
      });
      const conversation = demand
        ? await prisma.conversation.findUnique({
            where: {
              demandId_buyerId_bidderId: {
                demandId: payment.demandId as string,
                buyerId: demand.authorId,
                bidderId: existingBid.bidderId,
              },
            },
            select: { id: true },
          })
        : null;
      return {
        ok: true,
        bidId: existingBid.id,
        slot: existingBid.slot,
        conversationId: conversation?.id ?? "",
        demandFilled: demand?.status === "FILLED",
        alreadyCaptured: true,
      };
    }
    // CAPTURED but no Bid is an inconsistent state that should never
    // happen given the transaction below always creates both together --
    // surfaced loudly rather than silently retried.
    return { ok: false, code: "INCONSISTENT_STATE", message: "Payment captured without an allocation.", refunded: false };
  }
  if (payment.status === "REFUNDED" || payment.status === "FAILED") {
    return { ok: false, code: "PAYMENT_NOT_CAPTURABLE", message: `Payment already ${payment.status.toLowerCase()}.`, refunded: false };
  }

  // -- Allocate, atomically -------------------------------------------------
  type TxFailure = { code: string; message: string };
  let txFailure: TxFailure | null = null;

  const txResult = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const demand = await tx.demand.findUnique({
      where: { id: payment.demandId as string },
      select: { id: true, status: true, timelineEnd: true, authorId: true, maxSlots: true },
    });

    if (!demand || demand.status !== "OPEN" || demand.timelineEnd <= new Date()) {
      txFailure = { code: "DEMAND_UNAVAILABLE", message: "This request is closed." };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: txFailure.code } });
      return null;
    }

    const alreadyHeld = await tx.bid.findFirst({
      where: { demandId: demand.id, bidderId: payment.userId },
      select: { id: true },
    });
    if (alreadyHeld) {
      txFailure = { code: "ALREADY_HOLDS_SLOT", message: "You already have a response spot on this request." };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: txFailure.code } });
      return null;
    }

    const takenSlots = await tx.bid.findMany({ where: { demandId: demand.id }, select: { slot: true } });
    const takenSet = new Set(takenSlots.map((b) => b.slot));
    const maxSlots = demand.maxSlots ?? 3;
    let freeSlot: number | undefined;
    for (let s = 1; s <= maxSlots; s++) {
      if (!takenSet.has(s)) {
        freeSlot = s;
        break;
      }
    }

    if (freeSlot === undefined) {
      txFailure = { code: "DEMAND_FULL", message: "All response spots on this request are filled." };
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: txFailure.code } });
      return null;
    }

    const bid = await tx.bid.create({
      data: {
        demandId: demand.id,
        bidderId: payment.userId,
        slot: freeSlot,
        pitch: "", // see DECISIONS.md #27
        paymentId: payment.id,
      },
    });

    const conversation = await tx.conversation.upsert({
      where: {
        demandId_buyerId_bidderId: { demandId: demand.id, buyerId: demand.authorId, bidderId: payment.userId },
      },
      update: {},
      create: { demandId: demand.id, buyerId: demand.authorId, bidderId: payment.userId },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "CAPTURED", razorpayPaymentId, razorpaySignature: razorpaySignature ?? undefined },
    });

    const filledCount = takenSet.size + 1;
    let demandFilled = false;
    if (filledCount >= maxSlots) {
      await tx.demand.update({ where: { id: demand.id }, data: { status: "FILLED" } }); // see DECISIONS.md #28
      demandFilled = true;
    }

    return { bid, conversationId: conversation.id, demandFilled };
  });

  if (txFailure) {
    const failure = txFailure as TxFailure;
    // Section 3.4 step 5: refund automatically, unconditionally, right
    // here -- see DECISIONS.md #30. This runs outside the transaction
    // (it's a call to Razorpay's API, not our DB) but immediately after
    // it commits FAILED.
    let refunded = false;
    try {
      await createRefund(getRazorpayCreds(), {
        razorpayPaymentId,
        notes: { reason: failure.code, razorpayOrderId },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      refunded = true;
    } catch (err) {
      // Refund failed -- this needs a human. The Payment stays FAILED
      // (not REFUNDED) so it's visible in the admin payments table (M7)
      // as needing manual attention; we don't pretend it succeeded.
      console.error("captureSlotPayment: refund failed after allocation failure", {
        paymentId: payment.id,
        razorpayPaymentId,
        reason: failure.code,
        err,
      });
    }
    return { ok: false, code: failure.code, message: failure.message, refunded };
  }

  if (!txResult) {
    return { ok: false, code: "UNKNOWN_ERROR", message: "Could not take a response spot.", refunded: false };
  }

  // Fire-and-forget: notification failures never block the payment/allocation
  // result the caller is waiting on (see wa-notifications.ts's own doc
  // comment, and section 3.6's "WA failure NEVER blocks core flow"). Called
  // here -- inside captureSlotPayment itself, not by its callers -- so it
  // fires exactly once regardless of whether /api/payments/verify or the
  // webhook is the one that actually performed this allocation.
  void notifySlotPurchased(txResult.bid.id);

  return {
    ok: true,
    bidId: txResult.bid.id,
    slot: txResult.bid.slot,
    conversationId: txResult.conversationId,
    demandFilled: txResult.demandFilled,
    alreadyCaptured: false,
  };
}
