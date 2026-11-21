import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { calculateSlotPrice } from "@/lib/slot-pricing";
import { notifySlotPurchased } from "@/lib/wa-notifications";
import { authorizeCreditSpend, createInvoice, CreditPaymentError } from "@/lib/credit-payment";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const demand = await prisma.demand.findUnique({ where: { id }, select: { id: true, maxSlots: true } });
  if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

  const bids = await prisma.bid.findMany({
    where: { demandId: id },
    select: {
      slot: true,
      createdAt: true,
      bidder: {
        select: { id: true, name: true, avatarUrl: true, companyName: true, role: true },
      },
    },
    orderBy: { slot: "asc" },
  });

  return NextResponse.json({ slots: bids, maxSlots: demand.maxSlots ?? 3 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id: demandId } = await params;
    const { auth } = (await req.json().catch(() => ({}))) as { auth?: unknown };

    const demand = await prisma.demand.findUnique({
      where: { id: demandId },
      select: {
        id: true,
        status: true,
        timelineEnd: true,
        authorId: true,
        maxSlots: true,
        budgetMin: true,
        budgetMax: true,
        summary: true,
      },
    });

    if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");
    if (demand.status !== "OPEN" || demand.timelineEnd <= new Date()) {
      return apiError(409, "DEMAND_UNAVAILABLE", "This request is closed.");
    }
    if (demand.authorId === user.id) {
      return apiError(400, "CANNOT_BID_OWN_DEMAND", "You can't respond to your own request.");
    }

    const alreadyHeld = await prisma.bid.findFirst({
      where: { demandId, bidderId: user.id },
      select: { id: true },
    });
    if (alreadyHeld) {
      return apiError(409, "ALREADY_HOLDS_SLOT", "You already have a response spot on this request.");
    }

    const maxSlots = demand.maxSlots ?? 3;
    const takenCount = await prisma.bid.count({ where: { demandId } });
    if (takenCount >= maxSlots) {
      return apiError(409, "DEMAND_FULL", "All response spots on this request are filled.");
    }

    // Dynamic slot price calculation (min 40 credits / rupees or 0.1% of set budget)
    const { credits: requiredCredits, paise: amountPaise } = calculateSlotPrice(
      demand.budgetMax,
      demand.budgetMin,
    );

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditBalance: true },
    });
    const currentBalance = dbUser?.creditBalance ?? 0;

    if (currentBalance < requiredCredits) {
      return apiError(
        402,
        "INSUFFICIENT_CREDITS",
        `This response spot costs ${requiredCredits} credits. You have ${currentBalance} credits. Top up your wallet to continue.`,
        { requiredCredits, balance: currentBalance, shortage: requiredCredits - currentBalance },
      );
    }

    await authorizeCreditSpend(user.id, auth, requiredCredits);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const takenSlots = await tx.bid.findMany({ where: { demandId }, select: { slot: true } });
        const takenSet = new Set(takenSlots.map((b) => b.slot));

        let freeSlot: number | undefined;
        for (let s = 1; s <= maxSlots; s++) {
          if (!takenSet.has(s)) {
            freeSlot = s;
            break;
          }
        }

        if (freeSlot === undefined) {
          throw new Error("DEMAND_FULL");
        }

        // Deduct credits from user
        await applyCreditDelta(tx, {
          userId: user.id,
          amount: -requiredCredits,
          type: "BOOST",
          demandId: demand.id,
          note: `slot-purchase-slot-${freeSlot}`,
        });

        // Create Payment record for accounting and receipt history
        const syntheticOrderId = `cred_slot_${demand.id.slice(-6)}_${user.id.slice(-6)}_${Date.now()}`;
        const payment = await tx.payment.create({
          data: {
            userId: user.id,
            type: "SLOT",
            status: "CAPTURED",
            amountPaise,
            currency: "INR",
            razorpayOrderId: syntheticOrderId,
            demandId: demand.id,
            slotCount: 1,
          },
        });

        // Create Bid
        const bid = await tx.bid.create({
          data: {
            demandId: demand.id,
            bidderId: user.id,
            slot: freeSlot,
            pitch: "",
            paymentId: payment.id,
          },
        });

        // Upsert Conversation between buyer and bidder
        const conversation = await tx.conversation.upsert({
          where: { demandId_buyerId_bidderId: { demandId: demand.id, buyerId: demand.authorId, bidderId: user.id } },
          update: {},
          create: { demandId: demand.id, buyerId: demand.authorId, bidderId: user.id },
        });

        const newFilledCount = takenSet.size + 1;
        let demandFilled = false;
        if (newFilledCount >= maxSlots) {
          await tx.demand.update({ where: { id: demand.id }, data: { status: "FILLED" } });
          demandFilled = true;
        }

        const invoice = await createInvoice(tx, {
          userId: user.id,
          kind: "SLOT_PURCHASE",
          title: demand.summary,
          items: [{ label: `Response spot ${freeSlot}`, credits: requiredCredits }],
          demandId: demand.id,
        });

        return { bid, conversationId: conversation.id, demandFilled, invoice };
      });

      // Fire-and-forget notification
      void notifySlotPurchased(result.bid.id);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { creditBalance: true },
      });

      return NextResponse.json({
        ok: true,
        bidId: result.bid.id,
        slot: result.bid.slot,
        conversationId: result.conversationId,
        demandFilled: result.demandFilled,
        creditBalance: updatedUser?.creditBalance ?? 0,
        creditsUsed: requiredCredits,
        invoice: result.invoice,
      });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return apiError(402, "INSUFFICIENT_CREDITS", "Not enough credits for this response spot.");
      }
      if (err instanceof Error && err.message === "DEMAND_FULL") {
        return apiError(409, "DEMAND_FULL", "All response spots on this request were just filled.");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands/[id]/slots POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not take this response spot. Please try again.");
  }
}
