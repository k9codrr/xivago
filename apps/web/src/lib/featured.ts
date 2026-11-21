import "server-only";
import { prisma, applyCreditDelta, type Prisma, type FeaturedSettings } from "@/lib/db";
import { env } from "@/lib/env";
import { recordFeaturedRefund, deliverPendingNotifications } from "@/lib/notifications";
import { CATEGORIES_DATA } from "@/lib/categories";
import { DEMAND_CARD_SELECT, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { expireStaleBoosts } from "@/lib/boost";

/**
 * Featured hero placements: a repeating cycle (default 5 days) per niche.
 * Bids for cycle N are placed while cycle N-1 is live; at cycle N's
 * `startsAt` the auction closes and the winners go live until `endsAt`.
 * See the comment block above `FeaturedSettings` in schema.prisma.
 */

type Tx = Prisma.TransactionClient;

const HOUR = 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * HOUR;
/** A demand must stay open at least this long into the live window to be eligible. */
export const MIN_LIVE_OVERLAP_MS = 24 * HOUR;
/** A close that crashed midway is resumed once its claim is this old. */
const STALE_CLOSE_MS = 10 * 60 * 1000;

// ── Settings / switches ─────────────────────────────────────────────────

export async function getFeaturedSettings(): Promise<FeaturedSettings> {
  return prisma.featuredSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
}

/** Live only when the env master switch AND the admin toggle are both on. */
export function isFeaturedEnabled(settings: Pick<FeaturedSettings, "enabled">): boolean {
  return env.FEATURED_BIDDING_ENABLED && settings.enabled;
}

/** One niche per parent category. Creates missing rows; never overwrites admin edits. */
export async function ensureNiches(): Promise<void> {
  const existing = await prisma.featuredNiche.findMany({ select: { id: true } });
  const have = new Set(existing.map((n) => n.id));
  const missing = CATEGORIES_DATA.filter((c) => !have.has(c.id));
  if (missing.length) {
    await prisma.featuredNiche.createMany({
      data: missing.map((c) => ({ id: c.id, name: c.name })),
      skipDuplicates: true,
    });
  }
}

// ── Cycle timing ────────────────────────────────────────────────────────

/** First IST midnight at or after `from` (cycles close "Day 5 at 11:59 PM" IST). */
function nextIstMidnight(from: Date): Date {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  ist.setUTCHours(24, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export async function getBiddingCycle() {
  return prisma.featuredCycle.findFirst({
    where: { status: "BIDDING", closedAt: null, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}

export async function getLiveCycle() {
  return prisma.featuredCycle.findFirst({ where: { status: "LIVE" }, orderBy: { startsAt: "desc" } });
}

export async function ensureBiddingCycle(settings: FeaturedSettings): Promise<void> {
  const now = new Date();
  const upcoming = await prisma.featuredCycle.findFirst({ where: { status: "BIDDING", startsAt: { gt: now } } });
  if (upcoming) return;

  // Back-to-back with the live cycle; otherwise the first IST midnight that
  // leaves at least a day of bidding.
  const live = await getLiveCycle();
  const startsAt = live && live.endsAt > now ? live.endsAt : nextIstMidnight(new Date(now.getTime() + 24 * HOUR));
  const endsAt = new Date(startsAt.getTime() + settings.cycleDays * 24 * HOUR);
  await prisma.featuredCycle.upsert({ where: { startsAt }, update: {}, create: { startsAt, endsAt } });
}

// ── Credits ─────────────────────────────────────────────────────────────

async function refund(tx: Tx, bid: { id: string; userId: string; demandId: string }, amount: number, reason: string) {
  if (amount <= 0) return;
  await applyCreditDelta(tx, {
    userId: bid.userId,
    amount,
    type: "FEATURED_REFUND",
    demandId: bid.demandId,
    note: `featured-refund:${reason}:${bid.id}`,
  });
  // Pushed after commit by the job/route wrappers (or the cron sweep).
  await recordFeaturedRefund(tx, bid.userId, amount, bid.id, reason);
}

export async function holdCredits(tx: Tx, bid: { id: string; userId: string; demandId: string }, amount: number) {
  await applyCreditDelta(tx, {
    userId: bid.userId,
    amount: -amount,
    type: "FEATURED_HOLD",
    demandId: bid.demandId,
    note: `featured-hold:${bid.id}`,
  });
}

/** Refund a held bid in full and mark it cancelled (seller withdrew, or feature switched off). */
export async function cancelHeldBid(tx: Tx, bidId: string, reason: string) {
  const bid = await tx.featuredBid.findUnique({ where: { id: bidId } });
  if (!bid || bid.status !== "HELD") return;
  await tx.featuredBid.update({ where: { id: bid.id }, data: { status: "CANCELLED" } });
  await refund(tx, bid, bid.amount, reason);
}

/**
 * Pull a live placement (post removed/reported/expired, admin action, or
 * feature switched off). Everyone below moves up because display rank is
 * computed from the ACTIVE rows only; the seller gets the unused share back.
 */
export async function removePlacement(placementId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const p = await tx.featuredPlacement.findUnique({ where: { id: placementId }, include: { cycle: true } });
    if (!p || p.status !== "ACTIVE") return;
    const now = Date.now();
    const total = p.cycle.endsAt.getTime() - p.cycle.startsAt.getTime();
    const remaining = Math.min(Math.max(p.cycle.endsAt.getTime() - now, 0), total);
    const amount = total > 0 ? Math.floor((p.pricePaid * remaining) / total) : 0;
    await tx.featuredPlacement.update({
      where: { id: p.id },
      data: { status: "REMOVED", removedReason: reason, removedAt: new Date(now), refundedAmount: amount },
    });
    await refund(tx, { id: p.bidId, userId: p.userId, demandId: p.demandId }, amount, `prorata-${reason}`);
  });
}

// ── Eligibility ─────────────────────────────────────────────────────────

export interface EligibilityInput {
  user: { isVerified: boolean; isBanned: boolean };
  demand: { authorId: string; status: string; timelineEnd: Date; categoryParentId: string | null };
  userId: string;
  nicheId: string;
  cycleStartsAt: Date;
}

/** Returns a human-readable reason the bid is not allowed, or null if eligible. */
export function eligibilityError(i: EligibilityInput): string | null {
  if (i.user.isBanned) return "Your account is suspended.";
  if (!i.user.isVerified) return "Only verified accounts can feature a post.";
  if (i.demand.authorId !== i.userId) return "You can only feature your own posts.";
  if (i.demand.status !== "OPEN") return "Only open posts can be featured.";
  if (i.demand.categoryParentId !== i.nicheId) return "This post doesn't belong to that category.";
  if (i.demand.timelineEnd.getTime() < i.cycleStartsAt.getTime() + MIN_LIVE_OVERLAP_MS) {
    return "This post closes before or within a day of the featured window starting, so it can't be featured.";
  }
  return null;
}

// ── Quality score ───────────────────────────────────────────────────────

/**
 * 0.5–1.5 multiplier: seller rating (avg of the four rating dimensions) and
 * CTR on past featured placements. Unknown signals count as neutral (1.0),
 * so new sellers aren't penalised.
 */
async function qualityScores(userIds: string[]): Promise<Map<string, number>> {
  const [ratings, placements] = await Promise.all([
    prisma.rating.groupBy({
      by: ["ratedUserId"],
      where: { ratedUserId: { in: userIds } },
      _avg: { responsiveness: true, quality: true, timeliness: true, value: true },
    }),
    prisma.featuredPlacement.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _sum: { impressions: true, clicks: true },
    }),
  ]);

  const scores = new Map<string, number>();
  for (const id of userIds) {
    const r = ratings.find((x) => x.ratedUserId === id)?._avg;
    const avg = r ? ((r.responsiveness ?? 3) + (r.quality ?? 3) + (r.timeliness ?? 3) + (r.value ?? 3)) / 4 : null;
    const ratingFactor = avg == null ? 0 : (avg - 3) / 2; // -1..1

    const p = placements.find((x) => x.userId === id)?._sum;
    const impressions = p?.impressions ?? 0;
    const ctr = impressions > 0 ? (p?.clicks ?? 0) / impressions : 0;
    const ctrFactor = impressions >= 100 ? Math.max(-1, Math.min(1, (ctr - 0.02) / 0.02)) : 0;

    scores.set(id, 1 + 0.25 * ratingFactor + 0.25 * ctrFactor);
  }
  return scores;
}

/** Users who held rank 1 in this niche in each of the last `n` cycles. */
async function streakCappedUsers(nicheId: string, beforeStartsAt: Date, n: number): Promise<Set<string>> {
  if (n <= 0) return new Set();
  const recent = await prisma.featuredCycle.findMany({
    where: { startsAt: { lt: beforeStartsAt }, status: { in: ["LIVE", "ENDED"] } },
    orderBy: { startsAt: "desc" },
    take: n,
    select: { placements: { where: { nicheId, rank: 1 }, select: { userId: true } } },
  });
  if (recent.length < n) return new Set();
  const heroes = recent.map((c) => c.placements[0]?.userId);
  const first = heroes[0];
  return first && heroes.every((h) => h === first) ? new Set([first]) : new Set();
}

// ── Auction close ───────────────────────────────────────────────────────

type HeldBid = Prisma.FeaturedBidGetPayload<{ include: { demand: true; user: true } }>;

async function closeNiche(cycle: { id: string; startsAt: Date }, nicheId: string, settings: FeaturedSettings) {
  const niche = await prisma.featuredNiche.findUnique({ where: { id: nicheId } });
  const bids: HeldBid[] = await prisma.featuredBid.findMany({
    where: { cycleId: cycle.id, nicheId, status: "HELD" },
    include: { demand: true, user: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (!bids.length) return;

  const eligible: HeldBid[] = [];
  const rejected: HeldBid[] = [];
  for (const b of bids) {
    const err =
      !niche?.isActive
        ? "niche inactive"
        : eligibilityError({ user: b.user, demand: b.demand, userId: b.userId, nicheId, cycleStartsAt: cycle.startsAt });
    (err ? rejected : eligible).push(b);
  }

  const slots = Math.max(1, settings.slotsPerNiche);
  type Winner = { bid: HeldBid; rank: number; price: number; q: number | null };
  const winners: Winner[] = [];
  const losers: HeldBid[] = [...rejected];

  if (niche?.mode === "AUCTION") {
    const q = await qualityScores([...new Set(eligible.map((b) => b.userId))]);
    const score = (b: HeldBid) => b.amount * (q.get(b.userId) ?? 1);
    // Rank by bid × quality; ties go to whoever bid first (stable sort on createdAt order).
    const ranked = [...eligible].sort((a, b) => score(b) - score(a));

    const capped = await streakCappedUsers(nicheId, cycle.startsAt, settings.maxConsecutiveWins);
    if (ranked.length > 1 && capped.has(ranked[0]!.userId)) {
      const [first, second] = [ranked[0]!, ranked[1]!];
      ranked[0] = second;
      ranked[1] = first;
    }

    ranked.forEach((bid, i) => {
      if (i >= slots) {
        losers.push(bid);
        return;
      }
      const qi = q.get(bid.userId) ?? 1;
      const next = ranked[i + 1];
      // Second price: just enough to beat the next score, plus a step. Never
      // below the reserve, never above what the seller bid.
      const secondPrice = next ? Math.ceil(score(next) / qi) + settings.priceStep : niche.reservePrice;
      const price = Math.min(bid.amount, Math.max(niche.reservePrice, secondPrice));
      winners.push({ bid, rank: i + 1, price, q: qi });
    });
  } else {
    const hero = eligible.find((b) => b.wantsHero);
    if (hero) winners.push({ bid: hero, rank: 1, price: hero.amount, q: null });
    let rank = 2;
    for (const b of eligible) {
      if (b === hero) continue;
      if (b.wantsHero || rank > slots) losers.push(b); // over capacity (shouldn't happen — purchase checks it)
      else winners.push({ bid: b, rank: rank++, price: b.amount, q: null });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const w of winners) {
      const claimed = await tx.featuredBid.updateMany({
        where: { id: w.bid.id, status: "HELD" },
        data: { status: "WON", rank: w.rank, chargedAmount: w.price, qualityScore: w.q },
      });
      if (!claimed.count) continue;
      await tx.featuredPlacement.create({
        data: {
          cycleId: cycle.id,
          nicheId,
          demandId: w.bid.demandId,
          userId: w.bid.userId,
          bidId: w.bid.id,
          rank: w.rank,
          pricePaid: w.price,
        },
      });
      await refund(tx, w.bid, w.bid.amount - w.price, "won-difference");
    }
    for (const l of losers) {
      const claimed = await tx.featuredBid.updateMany({ where: { id: l.id, status: "HELD" }, data: { status: "LOST" } });
      if (claimed.count) await refund(tx, l, l.amount, "lost");
    }
  });
}

async function closeCycle(cycleId: string, settings: FeaturedSettings) {
  const now = new Date();
  // Claim the close so concurrent cron runs don't both process it. A stale
  // claim (crash midway) is resumable: processed bids are no longer HELD.
  const claimed = await prisma.featuredCycle.updateMany({
    where: {
      id: cycleId,
      status: "BIDDING",
      OR: [{ closedAt: null }, { closedAt: { lt: new Date(now.getTime() - STALE_CLOSE_MS) } }],
    },
    data: { closedAt: now },
  });
  if (!claimed.count) return false;

  const cycle = await prisma.featuredCycle.findUniqueOrThrow({ where: { id: cycleId } });
  const niches = await prisma.featuredBid.findMany({
    where: { cycleId, status: "HELD" },
    distinct: ["nicheId"],
    select: { nicheId: true },
  });
  for (const { nicheId } of niches) await closeNiche(cycle, nicheId, settings);

  // Only one cycle is live at a time.
  await prisma.featuredCycle.updateMany({ where: { status: "LIVE", id: { not: cycleId } }, data: { status: "ENDED" } });
  await prisma.featuredPlacement.updateMany({
    where: { status: "ACTIVE", cycle: { status: "ENDED" } },
    data: { status: "ENDED" },
  });
  await prisma.featuredCycle.update({ where: { id: cycleId }, data: { status: "LIVE" } });
  return true;
}

/** Feature switched off: refund every held bid and pull live placements pro-rata. */
async function shutDown() {
  const held = await prisma.featuredBid.findMany({ where: { status: "HELD" }, select: { id: true } });
  for (const b of held) await prisma.$transaction((tx) => cancelHeldBid(tx, b.id, "feature-disabled"));

  const active = await prisma.featuredPlacement.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const p of active) await removePlacement(p.id, "feature-disabled");

  await prisma.featuredCycle.updateMany({ where: { status: { in: ["BIDDING", "LIVE"] } }, data: { status: "CANCELLED" } });
  return { refundedBids: held.length, removedPlacements: active.length };
}

/**
 * The whole cycle state machine; safe to run as often as you like (the cron
 * runs it hourly, the admin "Run now" button on demand).
 */
export async function runFeaturedCycleJob() {
  try {
    return await runFeaturedCycleJobInner();
  } finally {
    void deliverPendingNotifications(); // refund notifications written during the job
  }
}

async function runFeaturedCycleJobInner() {
  const settings = await getFeaturedSettings();
  if (!isFeaturedEnabled(settings)) {
    return { enabled: false, ...(await shutDown()) };
  }

  await ensureNiches();
  const now = new Date();

  // 1) Close every auction whose live window has started.
  const due = await prisma.featuredCycle.findMany({
    where: { status: "BIDDING", startsAt: { lte: now } },
    orderBy: { startsAt: "asc" },
  });
  let closed = 0;
  for (const c of due) if (await closeCycle(c.id, settings)) closed++;

  // 2) End the live cycle once its window passes.
  const ended = await prisma.featuredCycle.updateMany({ where: { status: "LIVE", endsAt: { lte: now } }, data: { status: "ENDED" } });
  await prisma.featuredPlacement.updateMany({ where: { status: "ACTIVE", cycle: { status: "ENDED" } }, data: { status: "ENDED" } });

  // 3) Pull placements whose post was removed, closed, expired, or whose seller was banned.
  const broken = await prisma.featuredPlacement.findMany({
    where: {
      status: "ACTIVE",
      cycle: { status: "LIVE" },
      OR: [
        { demand: { status: { notIn: ["OPEN"] } } },
        { demand: { timelineEnd: { lte: now } } },
        { user: { isBanned: true } },
      ],
    },
    select: { id: true, demand: { select: { status: true } }, user: { select: { isBanned: true } } },
  });
  for (const p of broken) {
    await removePlacement(p.id, p.user.isBanned ? "seller-banned" : `post-${p.demand.status.toLowerCase()}`);
  }

  // 4) "Your slot ends tomorrow — bid again?"
  const endingSoon = await prisma.featuredPlacement.findMany({
    where: { status: "ACTIVE", endingNotifiedAt: null, cycle: { status: "LIVE", endsAt: { lte: new Date(now.getTime() + 24 * HOUR) } } },
    select: { id: true, rank: true, nicheId: true, demandId: true, niche: { select: { name: true } }, user: { select: { phone: true } }, cycle: { select: { endsAt: true } } },
  });
  for (const p of endingSoon) {
    if (p.user.phone) {
      await prisma.notificationLog.create({
        data: {
          toPhone: p.user.phone,
          templateName: "featured_slot_ending",
          status: "QUEUED",
          payload: { placementId: p.id, demandId: p.demandId, niche: p.niche.name, rank: p.rank, endsAt: p.cycle.endsAt.toISOString() },
        },
      });
    }
    await prisma.featuredPlacement.update({ where: { id: p.id }, data: { endingNotifiedAt: now } });
  }

  // 5) Always keep the next bidding window open.
  await ensureBiddingCycle(settings);

  return { enabled: true, closedAuctions: closed, endedCycles: ended.count, removedPlacements: broken.length, endingNotified: endingSoon.length };
}

// ── Display ─────────────────────────────────────────────────────────────

export type CardDemand = Prisma.DemandGetPayload<{ select: typeof DEMAND_CARD_SELECT }>;

export interface HeroSlide {
  kind: "sponsored" | "top" | "promo";
  placementId?: string;
  nicheId: string;
  nicheName: string;
  demand?: CardDemand;
}

export interface SponsoredEntry {
  placementId: string;
  displayRank: number;
  pricePaid: number;
  demand: CardDemand;
}

const openDemandWhere = (): Prisma.DemandWhereInput => ({
  status: { notIn: HIDDEN_FROM_FEED },
  timelineEnd: { gt: new Date() },
});

/**
 * Active placements for the live cycle, grouped by niche in display order.
 * Ranks close up over removed placements ("move everyone up a rank"), but a
 * FIXED niche whose hero was never sold keeps its ranked buyers from #2 on —
 * a ranked purchase doesn't get the hero for free.
 */
export async function getLiveSponsored(nicheId?: string): Promise<Map<string, SponsoredEntry[]>> {
  const live = await getLiveCycle();
  const out = new Map<string, SponsoredEntry[]>();
  if (!live) return out;
  const rows = await prisma.featuredPlacement.findMany({
    where: { cycleId: live.id, ...(nicheId ? { nicheId } : {}) },
    orderBy: [{ nicheId: "asc" }, { rank: "asc" }],
    select: { id: true, nicheId: true, rank: true, status: true, pricePaid: true, demand: { select: DEMAND_CARD_SELECT } },
  });
  const now = Date.now();
  const byNiche = new Map<string, typeof rows>();
  for (const r of rows) byNiche.set(r.nicheId, [...(byNiche.get(r.nicheId) ?? []), r]);

  for (const [id, list] of byNiche) {
    const offset = list.some((r) => r.rank === 1) ? 0 : 1;
    const visible = list.filter(
      (r) => r.status === "ACTIVE" && !HIDDEN_FROM_FEED.includes(r.demand.status) && r.demand.timelineEnd.getTime() > now,
    );
    if (visible.length) {
      out.set(
        id,
        visible.map((r, i) => ({ placementId: r.id, displayRank: i + 1 + offset, pricePaid: r.pricePaid, demand: r.demand })),
      );
    }
  }
  return out;
}

/** Best organic post per niche: priority, then most slots filled, then newest, preferring ones with images. */
async function topOrganicPerNiche(): Promise<Map<string, CardDemand>> {
  await expireStaleBoosts();
  const rows = await prisma.demand.findMany({
    where: { ...openDemandWhere(), categoryParentId: { not: null } },
    select: { ...DEMAND_CARD_SELECT, _count: { select: { bids: true } } },
    orderBy: [{ isPriority: "desc" }, { createdAt: "desc" }],
    take: 400,
  });
  const score = (d: (typeof rows)[number]) =>
    (d.isPriority ? 1000 : 0) + d._count.bids * 10 + (d.mediaUrls.length ? 5 : 0);
  const best = new Map<string, (typeof rows)[number]>();
  for (const d of rows) {
    const cur = best.get(d.categoryParentId!);
    if (!cur || score(d) > score(cur)) best.set(d.categoryParentId!, d);
  }
  return new Map([...best].map(([k, { _count, ...d }]) => [k, d]));
}

function pickWeighted<T extends { weight: number }>(items: T[]): T | undefined {
  const total = items.reduce((s, i) => s + Math.max(i.weight, 1), 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= Math.max(i.weight, 1);
    if (r <= 0) return i;
  }
  return items[0];
}

/**
 * Home hero slides.
 * - Enabled: one sponsored slide per niche (hero = rank 1, or rotated among
 *   the top N weighted by price), niches without a winner fall back to their
 *   best organic post, plus a "Feature your post here" promo.
 * - Disabled: the top organic listing of every niche.
 */
export async function getHeroSlides(): Promise<{ enabled: boolean; slides: HeroSlide[] }> {
  const settings = await getFeaturedSettings();
  const enabled = isFeaturedEnabled(settings);
  const name = (id: string) => CATEGORIES_DATA.find((c) => c.id === id)?.name ?? "Featured";
  const organic = await topOrganicPerNiche();

  if (!enabled) {
    const slides = CATEGORIES_DATA.filter((c) => organic.has(c.id)).map<HeroSlide>((c) => ({
      kind: "top",
      nicheId: c.id,
      nicheName: c.name,
      demand: organic.get(c.id),
    }));
    return { enabled, slides };
  }

  const sponsored = await getLiveSponsored();

  const sponsoredSlides: HeroSlide[] = [];
  const organicSlides: HeroSlide[] = [];
  for (const c of CATEGORIES_DATA) {
    const list = sponsored.get(c.id);
    if (list?.length) {
      const pool = list
        .filter((s) => s.displayRank <= Math.max(1, settings.heroRotateTopN))
        .map((s) => ({ ...s, weight: s.pricePaid }));
      const hero = pickWeighted(pool);
      if (!hero) {
        if (organic.has(c.id)) organicSlides.push({ kind: "top", nicheId: c.id, nicheName: name(c.id), demand: organic.get(c.id) });
        continue;
      }
      sponsoredSlides.push({ kind: "sponsored", placementId: hero.placementId, nicheId: c.id, nicheName: name(c.id), demand: hero.demand });
    } else if (organic.has(c.id)) {
      organicSlides.push({ kind: "top", nicheId: c.id, nicheName: name(c.id), demand: organic.get(c.id) });
    }
  }
  const promo: HeroSlide = { kind: "promo", nicheId: "", nicheName: "Featured" };
  return { enabled, slides: [...sponsoredSlides, ...organicSlides, promo] };
}
