import "server-only";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { createRefund, fetchPaymentCharges } from "@slotbook/payments";
import { getRazorpayCreds, isRazorpayConfigured } from "@/lib/razorpay-creds";
import { env } from "@/lib/env";
import { notifyAdminsRefundRequested, notifyPaymentRefunded, notifyRefundRequestRejected } from "@/lib/notifications";

/**
 * Refunds of credit top-ups to the customer's original payment method.
 *
 * The customer gets back what the platform actually received for the credits
 * they haven't spent yet:
 *   gross     = amount paid × (unspent credits ÷ credits bought)
 *   deduction = Razorpay's fee on the payment + the GST on that fee
 *               (Razorpay keeps both even when a payment is refunded)
 *             + for an instant refund, Razorpay's instant-refund fee + GST
 *   refund    = gross − deduction
 * The unspent credits are taken out of the wallet in the same step.
 */

const GST_RATE = 0.18;

export class RefundError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RefundError";
  }
}

export interface RefundQuote {
  paymentId: string;
  paidPaise: number;
  creditsBought: number;
  walletBalance: number;
  /** Credits that come out of the wallet — the unspent part of this top-up. */
  refundCredits: number;
  /** Share of the payment that matches the unspent credits. */
  grossPaise: number;
  /** Razorpay fee on the original payment, GST included. */
  feePaise: number;
  /** GST part of that fee. */
  taxPaise: number;
  instant: boolean;
  /** Instant-refund fee incl. GST (0 for a normal refund). */
  instantFeePaise: number;
  /** Whether instant refunds are set up (RAZORPAY_INSTANT_REFUND_FEE_PAISE). */
  instantAvailable: boolean;
  deductionPaise: number;
  /** What reaches the customer. */
  netPaise: number;
}

/** Instant fee incl. GST, or null when not configured. */
function instantFeeWithGst(): number | null {
  const base = env.RAZORPAY_INSTANT_REFUND_FEE_PAISE;
  if (base == null) return null;
  return Math.round(base * (1 + GST_RATE));
}

async function loadRefundable(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      amountPaise: true,
      slotCount: true,
      razorpayPaymentId: true,
      refundedAt: true,
      user: { select: { creditBalance: true } },
    },
  });
  if (!payment) throw new RefundError(404, "NOT_FOUND", "Payment not found.");
  if (payment.type !== "CREDITS") {
    throw new RefundError(422, "NOT_REFUNDABLE", "Only credit top-ups can be refunded from here.");
  }
  if (payment.status !== "CAPTURED" || payment.refundedAt) {
    throw new RefundError(409, "NOT_REFUNDABLE", `This payment is ${payment.status.toLowerCase()} and can't be refunded.`);
  }
  if (!payment.razorpayPaymentId) {
    throw new RefundError(409, "NOT_REFUNDABLE", "This payment has no Razorpay payment ID.");
  }
  if (!isRazorpayConfigured()) {
    throw new RefundError(503, "PAYMENTS_NOT_CONFIGURED", "Razorpay isn't set up on this environment.");
  }
  return payment as typeof payment & { razorpayPaymentId: string };
}

export async function getRefundQuote(paymentId: string, opts: { instant?: boolean } = {}): Promise<RefundQuote> {
  const payment = await loadRefundable(paymentId);
  const charges = await fetchPaymentCharges(getRazorpayCreds(), payment.razorpayPaymentId);
  if (charges.amountRefundedPaise > 0) {
    throw new RefundError(409, "ALREADY_REFUNDED", "Razorpay shows this payment was already (partly) refunded.");
  }

  const instantFee = instantFeeWithGst();
  const instantAvailable = instantFee != null;
  const instant = Boolean(opts.instant) && instantAvailable;

  const paidPaise = payment.amountPaise;
  const creditsBought = payment.slotCount ?? Math.floor(paidPaise / 100);
  const walletBalance = payment.user.creditBalance;
  const refundCredits = Math.max(0, Math.min(creditsBought, walletBalance));
  const grossPaise = creditsBought > 0 ? Math.floor((paidPaise * refundCredits) / creditsBought) : 0;
  const feePaise = charges.feePaise;
  const taxPaise = charges.taxPaise;
  const instantFeePaise = instant ? (instantFee ?? 0) : 0;
  const deductionPaise = Math.min(grossPaise, feePaise + instantFeePaise);
  const netPaise = grossPaise - deductionPaise;

  return {
    paymentId,
    paidPaise,
    creditsBought,
    walletBalance,
    refundCredits,
    grossPaise,
    feePaise,
    taxPaise,
    instant,
    instantFeePaise,
    instantAvailable,
    deductionPaise,
    netPaise,
  };
}

export interface RefundOutcome extends RefundQuote {
  refundId: string;
  speedProcessed: "instant" | "normal" | null;
  /** Instant fee given back because Razorpay fell back to a normal refund. */
  instantFeeReturnedPaise: number;
}

/** Refunds the net amount to the customer's original payment method and takes back the unspent credits. */
export async function refundPayment(
  paymentId: string,
  adminId: string,
  opts: { instant?: boolean } = {},
): Promise<RefundOutcome> {
  const quote = await getRefundQuote(paymentId, opts);
  if (opts.instant && !quote.instantAvailable) {
    throw new RefundError(422, "INSTANT_NOT_CONFIGURED", "Instant refunds aren't set up (RAZORPAY_INSTANT_REFUND_FEE_PAISE).");
  }
  if (quote.netPaise <= 0) {
    throw new RefundError(
      422,
      "NOTHING_TO_REFUND",
      quote.refundCredits === 0
        ? "The customer has already spent these credits, so there's nothing to refund."
        : "After the fees and GST there's nothing left to refund.",
    );
  }
  const payment = await loadRefundable(paymentId);

  // 1. Mark the payment refunded and take the credits back, atomically. If the
  //    wallet changed since the quote, the debit fails and nothing is written.
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: "CAPTURED", refundedAt: null },
        data: {
          status: "REFUNDED",
          refundedAt: new Date(),
          refundAmountPaise: quote.netPaise,
          refundDeductionPaise: quote.deductionPaise,
          refundCredits: quote.refundCredits,
        },
      });
      if (claimed.count === 0) throw new RefundError(409, "NOT_REFUNDABLE", "This payment was just refunded.");
      if (quote.refundCredits > 0) {
        await applyCreditDelta(tx, {
          userId: payment.userId,
          amount: -quote.refundCredits,
          type: "PAYMENT_REFUND",
          note: `payment-refund:${paymentId}:by:${adminId}`,
        });
      }
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw new RefundError(409, "BALANCE_CHANGED", "The customer's balance just changed. Reload and try again.");
    }
    throw err;
  }

  // 2. Send the money. If Razorpay refuses, undo step 1.
  const notes = {
    paymentId,
    refundCredits: String(quote.refundCredits),
    deductionPaise: String(quote.deductionPaise),
    reason: "admin-refund",
  };
  let refund: Awaited<ReturnType<typeof createRefund>>;
  try {
    refund = await createRefund(getRazorpayCreds(), {
      razorpayPaymentId: payment.razorpayPaymentId,
      amountPaise: quote.netPaise,
      notes,
      speed: quote.instant ? "optimum" : "normal",
    });
  } catch (err) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: "CAPTURED", refundedAt: null, refundAmountPaise: null, refundDeductionPaise: null, refundCredits: null },
      });
      if (quote.refundCredits > 0) {
        await applyCreditDelta(tx, {
          userId: payment.userId,
          amount: quote.refundCredits,
          type: "PAYMENT_REFUND",
          note: `payment-refund-reversed:${paymentId}`,
        });
      }
    });
    console.error("refundPayment: Razorpay refund failed, rolled back", { paymentId, err });
    // The Razorpay SDK rejects with { error: { description } }, not an Error.
    const detail =
      (err as { error?: { description?: string } })?.error?.description ??
      (err instanceof Error ? err.message : "unknown error");
    throw new RefundError(502, "RAZORPAY_REFUND_FAILED", `Razorpay refused the refund: ${detail}`);
  }

  // 3. Asked for instant but the bank only took a normal refund: Razorpay
  //    doesn't charge the instant fee then, so give it back to the customer.
  let instantFeeReturnedPaise = 0;
  if (quote.instant && refund.speedProcessed === "normal" && quote.instantFeePaise > 0) {
    try {
      await createRefund(getRazorpayCreds(), {
        razorpayPaymentId: payment.razorpayPaymentId,
        amountPaise: quote.instantFeePaise,
        notes: { ...notes, reason: "instant-fee-returned" },
      });
      instantFeeReturnedPaise = quote.instantFeePaise;
    } catch (err) {
      console.error("refundPayment: could not return the unused instant fee", { paymentId, err });
    }
  }

  const netPaise = quote.netPaise + instantFeeReturnedPaise;
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: {
        razorpayRefundId: refund.refundId,
        refundSpeed: refund.speedProcessed ?? (quote.instant ? "instant" : "normal"),
        refundAmountPaise: netPaise,
        refundDeductionPaise: quote.deductionPaise - instantFeeReturnedPaise,
      },
    }),
    // Any open request for this payment is now done.
    prisma.refundRequest.updateMany({
      where: { paymentId, status: "PENDING" },
      data: { status: "APPROVED", decidedById: adminId, decidedAt: new Date() },
    }),
  ]);
  void notifyPaymentRefunded(payment.userId, paymentId, netPaise, quote.refundCredits, refund.speedProcessed === "instant");

  return {
    ...quote,
    netPaise,
    deductionPaise: quote.deductionPaise - instantFeeReturnedPaise,
    refundId: refund.refundId,
    speedProcessed: refund.speedProcessed ?? null,
    instantFeeReturnedPaise,
  };
}

// ── Refund requests (user side) ─────────────────────────────────────────────

const MAX_REASON = 500;

/** A user asks for a top-up to go back to their bank. One open request per payment. */
export async function createRefundRequest(userId: string, paymentId: string, reason: string) {
  const text = reason.trim().slice(0, MAX_REASON);
  if (text.length < 5) throw new RefundError(400, "REASON_REQUIRED", "Tell us briefly why you want to withdraw.");

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { userId: true, type: true, status: true, refundedAt: true },
  });
  if (!payment || payment.userId !== userId) throw new RefundError(404, "NOT_FOUND", "Payment not found.");
  if (payment.type !== "CREDITS" || payment.status !== "CAPTURED" || payment.refundedAt) {
    throw new RefundError(409, "NOT_REFUNDABLE", "This top-up can't be withdrawn.");
  }

  const open = await prisma.refundRequest.findFirst({ where: { paymentId, status: "PENDING" }, select: { id: true } });
  if (open) throw new RefundError(409, "ALREADY_REQUESTED", "You've already asked to withdraw this top-up.");

  const request = await prisma.refundRequest.create({
    data: { paymentId, userId, reason: text },
    select: { id: true, status: true, reason: true, createdAt: true, payment: { select: { amountPaise: true } } },
  });
  void notifyAdminsRefundRequested(request.id, userId, request.payment.amountPaise, text);
  const { payment: _payment, ...shaped } = request;
  return shaped;
}

export async function cancelRefundRequest(userId: string, requestId: string) {
  const res = await prisma.refundRequest.updateMany({
    where: { id: requestId, userId, status: "PENDING" },
    data: { status: "CANCELLED", decidedAt: new Date() },
  });
  if (res.count === 0) throw new RefundError(404, "NOT_FOUND", "No open request to withdraw.");
}

export async function rejectRefundRequest(adminId: string, requestId: string, note: string) {
  const text = note.trim().slice(0, MAX_REASON);
  if (!text) throw new RefundError(400, "NOTE_REQUIRED", "Add a short note for the customer.");
  const req = await prisma.refundRequest.findUnique({ where: { id: requestId }, select: { userId: true, paymentId: true, status: true } });
  if (!req || req.status !== "PENDING") throw new RefundError(404, "NOT_FOUND", "This request is no longer open.");
  await prisma.refundRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", adminNote: text, decidedById: adminId, decidedAt: new Date() },
  });
  void notifyRefundRequestRejected(req.userId, req.paymentId, text);
}
