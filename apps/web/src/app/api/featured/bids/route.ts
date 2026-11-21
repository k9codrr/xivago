import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { featuredBidSchema } from "@/lib/validation/featured";
import { authorizeCreditSpend, createInvoice, CreditPaymentError } from "@/lib/credit-payment";
import {
  ensureBiddingCycle,
  ensureNiches,
  eligibilityError,
  getBiddingCycle,
  getFeaturedSettings,
  holdCredits,
  isFeaturedEnabled,
} from "@/lib/featured";

class SoldOutError extends Error {}
class BidChangedError extends Error {}

/**
 * Place or change the caller's bid for a niche in the open bidding window.
 * One bid per seller per niche per cycle; changing it holds/refunds only the
 * difference. AUCTION bids are sealed; FIXED purchases are first come, first
 * served against the niche's capacity.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { auth?: unknown };
    const parsed = featuredBidSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { demandId, wantsHero } = parsed.data;

    const settings = await getFeaturedSettings();
    if (!isFeaturedEnabled(settings)) return apiError(409, "FEATURE_DISABLED", "Featured listings are paused right now.");
    await ensureNiches();
    await ensureBiddingCycle(settings);
    const cycle = await getBiddingCycle();
    if (!cycle) return apiError(409, "NO_CYCLE", "The next bidding window hasn't opened yet.");

    const [me, demand] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { isVerified: true, isBanned: true } }),
      prisma.demand.findUnique({
        where: { id: demandId },
        select: { id: true, authorId: true, status: true, timelineEnd: true, categoryParentId: true, summary: true },
      }),
    ]);
    if (!demand) return apiError(404, "NOT_FOUND", "That post doesn't exist.");
    const nicheId = demand.categoryParentId;
    if (!nicheId) return apiError(409, "NO_NICHE", "This post has no category, so it can't be featured.");

    const reason = eligibilityError({ user: me, demand, userId: user.id, nicheId, cycleStartsAt: cycle.startsAt });
    if (reason) return apiError(409, "NOT_ELIGIBLE", reason);

    const niche = await prisma.featuredNiche.findUnique({ where: { id: nicheId } });
    if (!niche?.isActive) return apiError(409, "NICHE_INACTIVE", "Featured spots aren't available in this category right now.");

    let amount: number;
    if (niche.mode === "AUCTION") {
      if (parsed.data.amount == null) return apiError(400, "VALIDATION_ERROR", "Enter your bid amount.");
      if (parsed.data.amount < niche.reservePrice) {
        return apiError(409, "BELOW_RESERVE", `The minimum bid in ${niche.name} is ${niche.reservePrice} credits.`);
      }
      amount = parsed.data.amount;
    } else {
      amount = wantsHero ? niche.heroPrice : niche.rankedPrice;
    }

    // Only new credits going out need a T-PIN; lowering a bid refunds the difference.
    const currentBid = await prisma.featuredBid.findUnique({
      where: { cycleId_nicheId_userId: { cycleId: cycle.id, nicheId, userId: user.id } },
      select: { amount: true, status: true },
    });
    const authorizedCharge = amount - (currentBid?.status === "HELD" ? currentBid.amount : 0);
    if (authorizedCharge > 0) await authorizeCreditSpend(user.id, body.auth, authorizedCharge);

    const { bid, invoice } = await prisma.$transaction(async (tx) => {
      // Serialise purchases per niche+cycle so FIXED capacity checks can't race.
      const lockKey = `featured:${cycle.id}:${nicheId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const existing = await tx.featuredBid.findUnique({
        where: { cycleId_nicheId_userId: { cycleId: cycle.id, nicheId, userId: user.id } },
      });

      if (niche.mode === "FIXED") {
        const taken = await tx.featuredBid.count({
          where: { cycleId: cycle.id, nicheId, status: "HELD", wantsHero, NOT: { userId: user.id } },
        });
        const capacity = wantsHero ? 1 : Math.max(0, settings.slotsPerNiche - 1);
        if (taken >= capacity) {
          throw new SoldOutError(wantsHero ? "The hero spot in this category is already taken." : "All ranked spots in this category are taken.");
        }
      }

      const held = existing?.status === "HELD" ? existing.amount : 0;
      const row = existing
        ? await tx.featuredBid.update({
            where: { id: existing.id },
            data: { demandId, amount, wantsHero, status: "HELD", rank: null, chargedAmount: null, qualityScore: null },
          })
        : await tx.featuredBid.create({ data: { cycleId: cycle.id, nicheId, demandId, userId: user.id, amount, wantsHero } });

      const delta = amount - held;
      if (delta > 0 && delta !== authorizedCharge) throw new BidChangedError();
      if (delta > 0) await holdCredits(tx, row, delta);
      if (delta < 0) {
        await applyCreditDelta(tx, {
          userId: user.id,
          amount: -delta,
          type: "FEATURED_REFUND",
          demandId,
          note: `featured-refund:bid-lowered:${row.id}`,
        });
      }
      const invoice =
        delta > 0
          ? await createInvoice(tx, {
              userId: user.id,
              kind: "FEATURED_BID",
              title: demand.summary,
              items: [
                {
                  label: niche.mode === "AUCTION" ? `Auction bid hold · ${niche.name}` : `${wantsHero ? "Hero" : "Ranked"} spot · ${niche.name}`,
                  credits: delta,
                },
              ],
              demandId,
            })
          : null;

      return { bid: row, invoice };
    });

    return NextResponse.json({
      bid: { id: bid.id, nicheId: bid.nicheId, demandId: bid.demandId, amount: bid.amount, wantsHero: bid.wantsHero },
      closesAt: cycle.startsAt,
      invoice,
    });
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof BidChangedError) {
      return apiError(409, "AMOUNT_CHANGED", "Your bid changed while paying. Please review and try again.");
    }
    if (err instanceof SoldOutError) return apiError(409, "SOLD_OUT", err.message);
    if (err instanceof InsufficientCreditsError) {
      return apiError(402, "INSUFFICIENT_CREDITS", "Not enough credits for this bid. Top up and try again.");
    }
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("featured/bids POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not place your bid.");
  }
}
