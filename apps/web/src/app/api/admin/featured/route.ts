import { CATEGORIES_DATA } from "@/lib/categories";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { featuredSettingsPatchSchema } from "@/lib/validation/featured";
import {
  ensureNiches,
  getBiddingCycle,
  getFeaturedSettings,
  getLiveCycle,
  isFeaturedEnabled,
  runFeaturedCycleJob,
} from "@/lib/featured";

function handle(err: unknown, what: string) {
  if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
  if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
  console.error(`admin/featured ${what}: unexpected error`, err);
  return apiError(500, "INTERNAL_ERROR", "Could not load featured settings.");
}

/** Settings, niche config, the open auction (admins see amounts) and live placements. */
export async function GET() {
  try {
    await requireAdmin();
    await ensureNiches();
    const settings = await getFeaturedSettings();
    const [niches, cycle, liveCycle] = await Promise.all([
      prisma.featuredNiche.findMany({ where: { id: { in: CATEGORIES_DATA.map((c) => c.id) } } }),
      getBiddingCycle(),
      getLiveCycle(),
    ]);

    const [bids, placements, revenue] = await Promise.all([
      cycle
        ? prisma.featuredBid.findMany({
            where: { cycleId: cycle.id, status: "HELD" },
            orderBy: [{ nicheId: "asc" }, { amount: "desc" }],
            select: {
              id: true,
              nicheId: true,
              amount: true,
              wantsHero: true,
              createdAt: true,
              user: { select: { name: true, email: true } },
              demand: { select: { id: true, summary: true } },
            },
          })
        : [],
      liveCycle
        ? prisma.featuredPlacement.findMany({
            where: { cycleId: liveCycle.id },
            orderBy: [{ nicheId: "asc" }, { rank: "asc" }],
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
              user: { select: { name: true, email: true } },
              demand: { select: { id: true, summary: true } },
            },
          })
        : [],
      prisma.featuredPlacement.aggregate({ _sum: { pricePaid: true, refundedAmount: true } }),
    ]);

    return NextResponse.json({
      envEnabled: env.FEATURED_BIDDING_ENABLED,
      effectiveEnabled: isFeaturedEnabled(settings),
      settings,
      niches: niches.sort((a, b) => Number(a.id) - Number(b.id)),
      cycle,
      liveCycle,
      bids,
      placements,
      revenue: (revenue._sum.pricePaid ?? 0) - (revenue._sum.refundedAmount ?? 0),
    });
  } catch (err) {
    return handle(err, "GET");
  }
}

/**
 * Update global settings. Turning the feature off runs the cycle job right
 * away, which refunds every held bid and pulls live placements pro-rata.
 */
export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = featuredSettingsPatchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);

    const before = await getFeaturedSettings();
    const settings = await prisma.featuredSettings.update({ where: { id: "global" }, data: parsed.data });

    let job = null;
    if (isFeaturedEnabled(before) !== isFeaturedEnabled(settings)) job = await runFeaturedCycleJob();

    return NextResponse.json({ settings, job });
  } catch (err) {
    return handle(err, "PATCH");
  }
}
