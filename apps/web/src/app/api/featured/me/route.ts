import { CATEGORIES_DATA } from "@/lib/categories";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import {
  ensureBiddingCycle,
  ensureNiches,
  eligibilityError,
  getBiddingCycle,
  getFeaturedSettings,
  getLiveCycle,
  getLiveSponsored,
  isFeaturedEnabled,
} from "@/lib/featured";

/**
 * Seller dashboard for featured hero slots: the open bidding window, niche
 * pricing, the caller's eligible posts, their (sealed) bids, and results of
 * past placements. Other sellers' bid amounts are never returned.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const settings = await getFeaturedSettings();
    const enabled = isFeaturedEnabled(settings);

    if (enabled) {
      await ensureNiches();
      await ensureBiddingCycle(settings);
    }

    const [cycle, liveCycle, me, niches] = await Promise.all([
      enabled ? getBiddingCycle() : null,
      getLiveCycle(),
      prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { creditBalance: true, isVerified: true, isBanned: true } }),
      prisma.featuredNiche.findMany({ where: { id: { in: CATEGORIES_DATA.map((c) => c.id) } } }),
    ]);

    // FIXED niches show remaining capacity (counts only, never amounts).
    const capacity = cycle
      ? await prisma.featuredBid.groupBy({
          by: ["nicheId", "wantsHero"],
          where: { cycleId: cycle.id, status: "HELD" },
          _count: true,
        })
      : [];
    const count = (nicheId: string, hero: boolean) =>
      capacity.find((c) => c.nicheId === nicheId && c.wantsHero === hero)?._count ?? 0;

    const [demands, bids, placements] = await Promise.all([
      prisma.demand.findMany({
        where: { authorId: user.id, status: "OPEN", timelineEnd: { gt: new Date() }, categoryParentId: { not: null } },
        select: { id: true, summary: true, categoryParentId: true, categoryName: true, timelineEnd: true, status: true, authorId: true, mediaUrls: true },
        orderBy: { createdAt: "desc" },
      }),
      cycle
        ? prisma.featuredBid.findMany({
            where: { cycleId: cycle.id, userId: user.id, status: "HELD" },
            select: { id: true, nicheId: true, demandId: true, amount: true, wantsHero: true, updatedAt: true },
          })
        : [],
      prisma.featuredPlacement.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          nicheId: true,
          rank: true,
          status: true,
          pricePaid: true,
          impressions: true,
          clicks: true,
          refundedAmount: true,
          removedReason: true,
          demand: { select: { id: true, summary: true } },
          niche: { select: { name: true } },
          cycle: { select: { id: true, startsAt: true, endsAt: true, status: true } },
        },
      }),
    ]);

    // Leads = vendors who took a slot or opened a chat on the post during the window.
    const sponsored = liveCycle ? await getLiveSponsored() : new Map<string, { placementId: string; displayRank: number }[]>();
    const placementsWithLeads = await Promise.all(
      placements.map(async (p) => {
        const window = { gte: p.cycle.startsAt, lte: p.cycle.endsAt };
        const [slotLeads, chatLeads] = await Promise.all([
          prisma.bid.count({ where: { demandId: p.demand.id, createdAt: window } }),
          prisma.conversation.count({ where: { demandId: p.demand.id, createdAt: window } }),
        ]);
        const live = (sponsored.get(p.nicheId) ?? []).find((s) => s.placementId === p.id);
        return { ...p, leads: slotLeads + chatLeads, displayRank: live?.displayRank ?? null };
      }),
    );

    return NextResponse.json({
      enabled,
      balance: me.creditBalance,
      isVerified: me.isVerified,
      settings: { cycleDays: settings.cycleDays, slotsPerNiche: settings.slotsPerNiche },
      cycle,
      liveCycle,
      niches: niches
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((n) => ({
          id: n.id,
          name: n.name,
          mode: n.mode,
          isActive: n.isActive,
          reservePrice: n.reservePrice,
          heroPrice: n.heroPrice,
          rankedPrice: n.rankedPrice,
          heroTaken: count(n.id, true) > 0,
          rankedLeft: Math.max(0, settings.slotsPerNiche - 1 - count(n.id, false)),
        })),
      demands: demands.map((d) => ({
        id: d.id,
        summary: d.summary,
        nicheId: d.categoryParentId,
        nicheName: d.categoryName,
        cover: d.mediaUrls[0] ?? null,
        timelineEnd: d.timelineEnd,
        ineligibleReason: cycle
          ? eligibilityError({ user: me, demand: d, userId: user.id, nicheId: d.categoryParentId!, cycleStartsAt: cycle.startsAt })
          : null,
      })),
      bids,
      placements: placementsWithLeads,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("featured/me GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load featured listings.");
  }
}
