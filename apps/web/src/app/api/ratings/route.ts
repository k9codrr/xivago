import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { ratingCreateSchema, ratingSummaryQuerySchema } from "@/lib/validation/rating";
import { submitRating, getUserRatingSummary, DuplicateRatingError } from "@slotbook/db";
import { notifyRatingReceived } from "@/lib/notifications";

/** GET /api/ratings?userId=... -- public rating summary shown on a profile. */
export async function GET(req: NextRequest) {
  try {
    const parsed = ratingSummaryQuerySchema.safeParse({
      userId: req.nextUrl.searchParams.get("userId"),
    });
    if (!parsed.success) return apiValidationError(parsed.error);

    const summary = await getUserRatingSummary(prisma, parsed.data.userId);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("ratings GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load ratings.");
  }
}

/**
 * POST /api/ratings -- rate the other side of a bid/conversation engagement.
 * `direction` and `ratedUserId` are derived server-side from the bid, never
 * trusted from the client, so a rater can't spoof who they are or who
 * they're rating.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = ratingCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const bid = await prisma.bid.findUnique({
      where: { id: parsed.data.bidId },
      select: { bidderId: true, demand: { select: { authorId: true } } },
    });
    if (!bid) return apiError(404, "NOT_FOUND", "This engagement doesn't exist.");

    let direction: "SEEKER_TO_VENDOR" | "VENDOR_TO_SEEKER";
    let ratedUserId: string;
    if (user.id === bid.demand.authorId) {
      direction = "SEEKER_TO_VENDOR";
      ratedUserId = bid.bidderId;
    } else if (user.id === bid.bidderId) {
      direction = "VENDOR_TO_SEEKER";
      ratedUserId = bid.demand.authorId;
    } else {
      return apiError(403, "FORBIDDEN", "You weren't part of this engagement.");
    }

    const rating = await submitRating(prisma, {
      bidId: parsed.data.bidId,
      raterId: user.id,
      ratedUserId,
      direction,
      responsiveness: parsed.data.responsiveness,
      quality: parsed.data.quality,
      timeliness: parsed.data.timeliness,
      value: parsed.data.value,
      comment: parsed.data.comment ?? null,
    });

    const { responsiveness, quality, timeliness, value } = parsed.data;
    void notifyRatingReceived(user.id, ratedUserId, (responsiveness + quality + timeliness + value) / 4);

    return NextResponse.json({ rating });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    if (err instanceof DuplicateRatingError) {
      return apiError(409, "ALREADY_RATED", err.message);
    }
    console.error("ratings POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not submit rating.");
  }
}
