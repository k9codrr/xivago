import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** Why someone shows up in the Recommended row, strongest signal first. */
export type RecommendationReason = "scanned" | "bought_your_spot" | "you_bought" | "scanned_you" | "niche";

const REASON_WEIGHT: Record<RecommendationReason, number> = {
  scanned: 50,
  bought_your_spot: 45,
  you_bought: 40,
  scanned_you: 35,
  niche: 10,
};

const PERSON_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  companyName: true,
  isVerified: true,
  isBanned: true,
} as const;

const LIMIT = 20;
const PER_SOURCE = 15;

type Person = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  isVerified: boolean;
  isBanned: boolean;
};

/**
 * People to surface on Explore: those you've scanned, dealt with (either side of
 * a spot purchase), who scanned you, then people sharing your niches.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { categorySubIds: true },
    });
    if (!me) return apiError(404, "NOT_FOUND", "Profile not found.");

    const [scansMade, scansReceived, spotsOnMyPosts, spotsIBought, myDemandNiches] = await Promise.all([
      prisma.qrScan.findMany({
        where: { scannerId: user.id },
        orderBy: { lastScannedAt: "desc" },
        take: PER_SOURCE,
        select: { lastScannedAt: true, scanned: { select: PERSON_SELECT } },
      }),
      prisma.qrScan.findMany({
        where: { scannedId: user.id },
        orderBy: { lastScannedAt: "desc" },
        take: PER_SOURCE,
        select: { lastScannedAt: true, scanner: { select: PERSON_SELECT } },
      }),
      prisma.bid.findMany({
        where: { demand: { authorId: user.id } },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: { createdAt: true, bidder: { select: PERSON_SELECT } },
      }),
      prisma.bid.findMany({
        where: { bidderId: user.id },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: { createdAt: true, demand: { select: { author: { select: PERSON_SELECT } } } },
      }),
      me.categorySubIds.length
        ? Promise.resolve([] as { categorySubId: string | null }[])
        : prisma.demand.findMany({
            where: { authorId: user.id, categorySubId: { not: null } },
            distinct: ["categorySubId"],
            take: 10,
            select: { categorySubId: true },
          }),
    ]);

    const picked = new Map<string, { person: Person; reasons: Set<RecommendationReason>; score: number; at: number }>();
    const add = (person: Person, reason: RecommendationReason, at: Date) => {
      if (person.id === user.id || person.isBanned) return;
      const entry = picked.get(person.id) ?? { person, reasons: new Set(), score: 0, at: 0 };
      if (!entry.reasons.has(reason)) {
        entry.reasons.add(reason);
        entry.score += REASON_WEIGHT[reason];
      }
      entry.at = Math.max(entry.at, at.getTime());
      picked.set(person.id, entry);
    };

    scansMade.forEach((s) => add(s.scanned, "scanned", s.lastScannedAt));
    spotsOnMyPosts.forEach((b) => add(b.bidder, "bought_your_spot", b.createdAt));
    spotsIBought.forEach((b) => add(b.demand.author, "you_bought", b.createdAt));
    scansReceived.forEach((s) => add(s.scanner, "scanned_you", s.lastScannedAt));

    // Niche matches fill the rest of the row.
    const nicheIds = me.categorySubIds.length
      ? me.categorySubIds
      : myDemandNiches.map((d) => d.categorySubId).filter((id): id is string => !!id);
    const room = LIMIT - picked.size;
    if (nicheIds.length && room > 0) {
      const sameNiche = await prisma.user.findMany({
        where: {
          id: { notIn: [user.id, ...picked.keys()] },
          isBanned: false,
          categorySubIds: { hasSome: nicheIds },
        },
        orderBy: [{ isVerified: "desc" }, { updatedAt: "desc" }],
        take: room,
        select: { ...PERSON_SELECT, updatedAt: true },
      });
      sameNiche.forEach(({ updatedAt, ...p }) => add(p, "niche", updatedAt));
    }

    const people = [...picked.values()]
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, LIMIT)
      .map(({ person: { isBanned: _banned, ...p }, reasons }) => {
        const ordered = [...reasons].sort((a, b) => REASON_WEIGHT[b] - REASON_WEIGHT[a]);
        return { ...p, reason: ordered[0]!, reasons: ordered };
      });

    return NextResponse.json({ people });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("recommendations/people GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load recommendations.");
  }
}
