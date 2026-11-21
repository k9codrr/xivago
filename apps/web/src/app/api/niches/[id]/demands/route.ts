import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { getOptionalUser } from "@/lib/guards";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { DEMAND_CARD_SELECT, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { haversineKm } from "@/lib/geo";
import { getParentCategoryById } from "@/lib/categories";
import { demandCategoryWhere } from "@/lib/category-selection";
import { expireStaleBoosts } from "@/lib/boost";

const MAX_RESULTS = 300;

/**
 * Every open demand in a niche, closest first when lat/lng are given
 * (demands without coordinates go last), otherwise newest first. Optional
 * `sub` narrows to one sub-category; `provider` / `problem` narrow further
 * (older demands in the same sub that never picked a provider still match).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getParentCategoryById(id)) return apiError(404, "NOT_FOUND", "Unknown category.");

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") ?? NaN);
  const lng = Number(url.searchParams.get("lng") ?? NaN);
  const sub = url.searchParams.get("sub");
  const provider = url.searchParams.get("provider");
  const problem = url.searchParams.get("problem");
  const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
  const viewer = await getOptionalUser();
  await expireStaleBoosts();

  const rows = await prisma.demand.findMany({
    where: {
      ...demandCategoryWhere({
        category: id,
        subCategory: sub ?? undefined,
        provider: provider ?? undefined,
        problem: problem ?? undefined,
      }),
      status: { notIn: HIDDEN_FROM_FEED },
      timelineEnd: { gt: new Date() },
    },
    select: DEMAND_CARD_SELECT,
    orderBy: [{ isPriority: "desc" }, { createdAt: "desc" }],
    take: MAX_RESULTS,
  });

  const demands = rows.map((d) => ({
    ...maskDemandAuthor(d, viewer),
    distanceKm: hasGeo && d.lat != null && d.lng != null ? Math.round(haversineKm(lat, lng, d.lat, d.lng) * 10) / 10 : null,
  }));
  if (hasGeo) demands.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

  return NextResponse.json({ demands });
}
