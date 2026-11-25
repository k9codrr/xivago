import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const offerSchema = z.object({
  proposedPrice: z.number().positive("Price must be positive").max(100_000_000),
  message: z.string().trim().max(500).optional(),
});

/**
 * POST /api/demands/[id]/offer
 * Allows a user who has taken a response spot on a demand to send a proposed
 * price offer directly into their conversation with the demand owner.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: demandId } = await params;

    const body = await req.json().catch(() => null);
    const parsed = offerSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const demand = await prisma.demand.findUnique({
      where: { id: demandId },
      select: { id: true, authorId: true, status: true },
    });
    if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");
    if (demand.status !== "OPEN") {
      return apiError(409, "DEMAND_CLOSED", "This request is closed.");
    }

    // Verify the user holds a spot on this demand
    const bid = await prisma.bid.findFirst({
      where: { demandId, bidderId: user.id },
      select: { id: true },
    });
    if (!bid) {
      return apiError(403, "SPOT_REQUIRED", "Take a response spot first to send an offer.");
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        demandId_buyerId_bidderId: {
          demandId,
          buyerId: demand.authorId,
          bidderId: user.id,
        },
      },
      select: { id: true },
    });
    if (!conversation) {
      return apiError(404, "NO_CONVERSATION", "Conversation not found for this spot.");
    }

    const formattedPrice = `₹${parsed.data.proposedPrice.toLocaleString("en-IN")}`;
    const text = parsed.data.message
      ? `💰 Offer: ${formattedPrice}\n${parsed.data.message}`
      : `💰 Offer: ${formattedPrice}`;

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        text,
      },
      select: { id: true, text: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, conversationId: conversation.id, message }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("POST /api/demands/[id]/offer error:", err);
    return apiError(500, "INTERNAL_ERROR", "Could not send offer.");
  }
}
