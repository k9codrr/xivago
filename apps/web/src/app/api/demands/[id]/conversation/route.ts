import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/**
 * Resolves the conversation for the current user's relationship to a
 * demand -- the single indirection point the "Chat" buttons on the demand
 * detail page and slot strip go through, so they don't need to know
 * Conversation's (demandId, bidderId) key shape directly.
 *
 * - A bidder on this demand: `?bidderId` is optional and, if given, MUST
 *   equal their own id (they can't peek at another bidder's thread with
 *   the author) -- resolves to their own conversation.
 * - The demand's author: `?bidderId` is REQUIRED (a demand can have up to
 *   3 separate conversations, one per slot holder, so there's no single
 *   answer without disambiguating) -- resolves to the conversation with
 *   that specific bidder.
 * - Admin: same as author, `?bidderId` required, read-only once inside.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: demandId } = await params;

    const demand = await prisma.demand.findUnique({ where: { id: demandId }, select: { authorId: true } });
    if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

    const requestedBidderId = req.nextUrl.searchParams.get("bidderId");
    const isAuthor = demand.authorId === user.id;

    let bidderId: string;
    if (isAuthor || user.isAdmin) {
      if (!requestedBidderId) {
        return apiError(
          400,
          "BIDDER_ID_REQUIRED",
          "Specify which bidder's conversation to open (?bidderId=...).",
        );
      }
      bidderId = requestedBidderId;
    } else {
      if (requestedBidderId && requestedBidderId !== user.id) {
        return apiError(403, "FORBIDDEN", "You can only open your own chat on this request.");
      }
      bidderId = user.id;
    }

    const conversation = await prisma.conversation.findUnique({
      where: { demandId_buyerId_bidderId: { demandId, buyerId: demand.authorId, bidderId } },
      select: { id: true },
    });
    if (!conversation) {
      return apiError(404, "NOT_FOUND", "No chat yet. It opens automatically once a provider takes a response spot.");
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands/conversation: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not open this chat.");
  }
}
