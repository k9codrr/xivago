import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { SERVICE_AREA_TYPES } from "@/lib/service-area";

const STATUSES = ["OPEN", "EXPIRED", "FILLED", "CANCELLED"] as const;

/**
 * All demands including EXPIRED/FILLED/CANCELLED -- section 3.12: "Demands: all incl. EXPIRED, force-expire, delete."
 * Filters: ?type=PROMOTE|REQUIREMENT &status=.. &area=NEARBY|REGIONS|ALL_INDIA|ONLINE &featured=1 &q=text
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type");
    const status = sp.get("status");
    const area = sp.get("area");
    const q = sp.get("q")?.trim().slice(0, 80);
    const now = new Date();

    const where: Prisma.DemandWhereInput = {
      ...(type === "PROMOTE" || type === "REQUIREMENT" ? { postType: type } : {}),
      ...(status && (STATUSES as readonly string[]).includes(status) ? { status: status as (typeof STATUSES)[number] } : {}),
      ...(area && (SERVICE_AREA_TYPES as readonly string[]).includes(area) ? { serviceAreaType: area } : {}),
      ...(sp.get("featured") === "1" ? { isPriority: true, priorityExpiresAt: { gt: now } } : {}),
      ...(q
        ? {
            OR: [
              { summary: { contains: q, mode: "insensitive" } },
              { author: { name: { contains: q, mode: "insensitive" } } },
              { author: { email: { contains: q, mode: "insensitive" } } },
              { id: q },
            ],
          }
        : {}),
    };

    const [demands, counts] = await Promise.all([
      prisma.demand.findMany({
        where,
        select: {
          id: true,
          postType: true,
          summary: true,
          status: true,
          isPriority: true,
          priorityExpiresAt: true,
          timelineEnd: true,
          createdAt: true,
          budgetMin: true,
          budgetMax: true,
          priceUnit: true,
          serviceAreaType: true,
          serviceAreas: true,
          serviceRadiusKm: true,
          serviceOnline: true,
          completionTimeline: true,
          maxSlots: true,
          shareContact: true,
          tags: true,
          categoryName: true,
          subCategoryName: true,
          categoryParentId: true,
          categorySubId: true,
          customProviderName: true,
          locationName: true,
          mediaUrls: true,
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { bids: true, engagements: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.demand.groupBy({ by: ["postType", "status"], _count: { _all: true } }),
    ]);

    return NextResponse.json({
      demands,
      counts: counts.map((c) => ({ postType: c.postType, status: c.status, count: c._count._all })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load posts.");
  }
}
