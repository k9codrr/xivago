import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { cancelHeldBid } from "@/lib/featured";
import { deliverPendingNotifications } from "@/lib/notifications";

/** Withdraw a bid before the auction closes; the full hold is refunded. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const bid = await prisma.featuredBid.findUnique({ where: { id }, include: { cycle: true } });
    if (!bid || bid.userId !== user.id) return apiError(404, "NOT_FOUND", "Bid not found.");
    if (bid.status !== "HELD" || bid.cycle.status !== "BIDDING" || bid.cycle.closedAt || bid.cycle.startsAt <= new Date()) {
      return apiError(409, "CONFLICT", "This auction has already closed.");
    }

    await prisma.$transaction((tx) => cancelHeldBid(tx, bid.id, "withdrawn"));
    void deliverPendingNotifications();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("featured/bids DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not withdraw your bid.");
  }
}
