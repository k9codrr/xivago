import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { getOptionalUser, requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { demandCreateSchema, demandFeedQuerySchema } from "@/lib/validation/demand";
import { DEMAND_CARD_SELECT, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { haversineKm, getBoundingBox } from "@/lib/geo";
import { DEMAND_POST_CREDIT_COST } from "@/lib/slot-pricing";
import { notifyFollowersOfDemand } from "@/lib/notifications";
import { demandCategoryWhere, resolveDemandCategory } from "@/lib/category-selection";
import { isKnownTag, normalizeTag } from "@/lib/category-tags.server";
import { customTagError } from "@/lib/custom-tags";
import { authorizeCreditSpend, createInvoice, CreditPaymentError } from "@/lib/credit-payment";
import { expireStaleBoosts, getBoostSettings } from "@/lib/boost";
import { boostEndsAt, boostLimits } from "@/lib/boost-shared";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = demandFeedQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { cursor, limit, q, budgetMin, budgetMax, category, subCategory, provider, problem, tags, lat, lng, radiusKm = 25, timeFilter } = parsed.data;

  const viewer = await getOptionalUser(); // the feed is public, but only slot holders see who posted
  // Featured posts sort first (isPriority desc); drop the ones whose paid days ran out.
  await expireStaleBoosts();

  // Distance filtering: only active if lat/lng are supplied AND radiusKm is not explicitly "all"
  const isGeoFiltered = lat != null && lng != null && radiusKm !== "all";
  const numericRadius = typeof radiusKm === "number" ? radiusKm : 25;
  const bbox = isGeoFiltered ? getBoundingBox(lat, lng, numericRadius) : null;

  // Time filtering: 24h, 2d, or all
  let createdAtFilter: { gte?: Date } | undefined = undefined;
  if (timeFilter === "24h") {
    createdAtFilter = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  } else if (timeFilter === "2d") {
    createdAtFilter = { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) };
  }

  const rawDemands = await prisma.demand.findMany({
    where: {
      status: { notIn: HIDDEN_FROM_FEED },
      timelineEnd: { gt: new Date() },
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...demandCategoryWhere({ category, subCategory, provider, problem, tags }),
      ...(bbox
        ? {
            lat: { gte: bbox.minLat, lte: bbox.maxLat },
            lng: { gte: bbox.minLng, lte: bbox.maxLng },
          }
        : {}),
      ...(q ? { summary: { contains: q, mode: "insensitive" } } : {}),
      ...(budgetMin != null ? { budgetMax: { gte: budgetMin } } : {}),
      ...(budgetMax != null ? { budgetMin: { lte: budgetMax } } : {}),
    },
    select: DEMAND_CARD_SELECT,
    orderBy: [{ isPriority: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: isGeoFiltered ? limit * 2 + 1 : limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  // If geo-filtered, apply exact haversine distance check and attach distance
  let filtered = rawDemands;
  if (isGeoFiltered) {
    filtered = rawDemands
      .filter((d) => {
        if (d.lat == null || d.lng == null) return false;
        const dist = haversineKm(lat, lng, d.lat, d.lng);
        return dist <= numericRadius;
      })
      .map((d) => {
        const dist = haversineKm(lat, lng, d.lat!, d.lng!);
        return {
          ...d,
          distanceKm: Math.round(dist * 10) / 10,
        };
      });
  }

  const hasMore = filtered.length > limit;
  const page = hasMore ? filtered.slice(0, limit) : filtered;

  return NextResponse.json({
    demands: page.map((d) => maskDemandAuthor(d, viewer)),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  });
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const parsed = demandCreateSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const data = parsed.data;

    const categoryPick = resolveDemandCategory(data);
    if (!categoryPick.ok) return apiError(400, "INVALID_CATEGORY", categoryPick.message);
    const category = categoryPick.value;

    const tags = Array.from(new Set(data.tags.map(normalizeTag)));
    // Workbook tags are always fine; anything else is a custom tag and must pass the custom rules.
    for (const tag of tags) {
      if (isKnownTag(tag)) continue;
      const problem = customTagError(tag);
      if (problem) return apiError(400, "INVALID_TAGS", `"${tag}": ${problem}.`);
    }

    // Role is optional (the role step is disabled in the post flow); validate it only when sent.
    if (data.postType === "REQUIREMENT" && data.requirementRoleId) {
      const role = await prisma.requirementRole.findFirst({
        where: { id: data.requirementRoleId, isActive: true },
        select: { id: true },
      });
      if (!role) return apiError(400, "INVALID_ROLE", "That role is no longer available. Please pick another.");
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditBalance: true },
    });

    // Featured boost: pricePerDay x days, with days inside the admin's min..max.
    const boostSettings = data.isPriority ? await getBoostSettings() : null;
    const boost = boostSettings ? boostLimits(boostSettings, "new") : null;
    const boostDays = boost ? data.boostDays ?? boost.minDays : 0;
    if (boost && (boostDays < boost.minDays || boostDays > boost.maxDays)) {
      return apiError(400, "INVALID_DAYS", `Featured boosts run from ${boost.minDays} to ${boost.maxDays} days.`);
    }
    const boostCredits = boost ? boost.pricePerDay * boostDays : 0;
    const boostEnd = boost ? boostEndsAt(boostDays, null) : null;
    // The post stays up for every featured day it was paid for.
    const timelineEnd = boostEnd && boostEnd > data.timelineEnd ? boostEnd : data.timelineEnd;

    const totalCreditsRequired = DEMAND_POST_CREDIT_COST + boostCredits;
    const currentBalance = dbUser?.creditBalance ?? 0;

    if (currentBalance < totalCreditsRequired) {
      return apiError(
        402,
        "INSUFFICIENT_CREDITS",
        `Posting a demand requires ${DEMAND_POST_CREDIT_COST} credits${
          boost ? ` (plus ${boostCredits} credits for ${boostDays} featured days)` : ""
        }. You have ${currentBalance} credits. Please top up your credits to post.`,
        { required: totalCreditsRequired, balance: currentBalance },
      );
    }

    await authorizeCreditSpend(user.id, (body as { auth?: unknown }).auth, totalCreditsRequired);

    try {
      const { demand, invoice } = await prisma.$transaction(async (tx) => {
        const created = await tx.demand.create({
          data: {
            authorId: user.id,
            postType: data.postType,
            requirementRoleId: data.postType === "REQUIREMENT" ? data.requirementRoleId : null,
            summary: data.summary,
            budgetMin: data.budget ?? null,
            budgetMax: data.budget ?? null,
            timelineEnd,
            completionTimeline: data.completionTimeline,
            completionDate: data.completionTimeline === "DATE" ? data.completionDate ?? null : null,
            shareContact: data.shareContact,
            maxSlots: data.maxSlots ?? 3,
            isPriority: data.isPriority,
            priorityExpiresAt: boostEnd,
            ...category,
            tags,
            selectedTechInputs: data.selectedTechInputs ?? undefined,
            mediaUrls: data.mediaUrls ?? [],
            lat: data.lat ?? null,
            lng: data.lng ?? null,
            locationName: data.locationName || null,
          },
        });

        // Deduct 10 credits for posting demand
        await applyCreditDelta(tx, {
          userId: user.id,
          amount: -DEMAND_POST_CREDIT_COST,
          type: "BOOST",
          demandId: created.id,
          note: "post-demand-fee",
        });

        if (boost) {
          await applyCreditDelta(tx, {
            userId: user.id,
            amount: -boostCredits,
            type: "BOOST",
            demandId: created.id,
            note: `priority-boost-on-create-${boostDays}d`,
          });
        }

        const invoice = await createInvoice(tx, {
          userId: user.id,
          kind: "DEMAND_POST",
          title: created.summary,
          items: [
            { label: "Posting fee", credits: DEMAND_POST_CREDIT_COST },
            ...(boost
              ? [{ label: `Featured boost · ${boostDays} day${boostDays === 1 ? "" : "s"} × ${boost.pricePerDay}`, credits: boostCredits }]
              : []),
          ],
          demandId: created.id,
        });

        return { demand: created, invoice };
      });

      void notifyFollowersOfDemand(demand.id);

      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { creditBalance: true },
      });

      return NextResponse.json(
        { demand, invoice, creditBalance: updatedUser?.creditBalance ?? 0 },
        { status: 201 },
      );
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return apiError(
          402,
          "INSUFFICIENT_CREDITS",
          `Insufficient credits: need ${totalCreditsRequired}, but balance is too low. Please top up your credits.`,
        );
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not post. Please try again.");
  }
}
