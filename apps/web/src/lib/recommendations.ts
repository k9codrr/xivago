import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEMAND_CARD_SELECT, HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { maskDemandAuthor } from "@/lib/demand-privacy";
import { haversineKm } from "@/lib/geo";
import { LOCATION_FREE_AREA_TYPES } from "@/lib/service-area";
import { unitRandom } from "@/lib/featured-rotation";

/**
 * "For you" picks: a few offers / requests (and, on Explore, feed posts)
 * chosen per viewer from every signal we have, then sampled at random so
 * each visit shows a different set:
 *
 *   - niches picked at onboarding (User.categorySubIds / provider / problem ids)
 *   - what they interacted with: demands viewed or opened, saved, responded to;
 *     feed posts they reacted to (→ those authors), people they follow
 *   - where they are (when the client sends a location)
 *   - featured (paid) posts
 *   - popularity (views, reactions, comments) and freshness
 *
 * The pick is a weighted random sample without replacement
 * (Efraimidis–Spirakis), seeded by the client, so pages of one visit agree.
 */

export const RECOMMENDATION_LIMIT = 10;

const DAY = 24 * 60 * 60 * 1000;
const DEMAND_SCAN = 160;
const POST_SCAN = 200;
const INTEREST_WINDOW_DAYS = 60;

export interface RecommendationOptions {
  viewerId: string;
  seed: string;
  lat?: number | null;
  lng?: number | null;
  limit?: number;
  /** Ids already on screen, so a second strip doesn't repeat the first. */
  excludeIds?: string[];
}

interface ViewerSignals {
  subs: Set<string>;
  parents: Set<string>;
  interestSubs: Set<string>;
  followed: Set<string>;
  likedAuthors: Set<string>;
  seenDemandIds: Set<string>;
}

const subOf = (id: string) => id.split(".").slice(0, 2).join(".");
const parentOf = (id: string) => id.split(".")[0]!;

async function loadSignals(viewerId: string): Promise<ViewerSignals> {
  const since = new Date(Date.now() - INTEREST_WINDOW_DAYS * DAY);
  const [me, engaged, saved, bids, follows, reactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { categorySubIds: true, categoryProviderIds: true, categoryProblemIds: true },
    }),
    prisma.demandEngagement.findMany({
      where: { viewerKey: `u:${viewerId}`, day: { gte: since } },
      orderBy: { day: "desc" },
      take: 300,
      select: { demandId: true, demand: { select: { categorySubId: true } } },
    }),
    prisma.bookmark.findMany({
      where: { userId: viewerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { demand: { select: { categorySubId: true } } },
    }),
    prisma.bid.findMany({
      where: { bidderId: viewerId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { demand: { select: { categorySubId: true } } },
    }),
    prisma.follow.findMany({ where: { followerId: viewerId }, select: { followingId: true }, take: 2000 }),
    prisma.forumReaction.findMany({
      where: { userId: viewerId, targetType: "MESSAGE", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { targetId: true },
    }),
  ]);

  const likedPosts = reactions.length
    ? await prisma.forumMessage.findMany({
        where: { id: { in: reactions.map((r) => r.targetId) } },
        select: { senderId: true },
      })
    : [];

  const subs = new Set<string>([
    ...(me?.categorySubIds ?? []),
    ...(me?.categoryProviderIds ?? []).map(subOf),
    ...(me?.categoryProblemIds ?? []).map(subOf),
  ]);
  const interestSubs = new Set<string>();
  for (const row of [...engaged, ...saved, ...bids]) {
    const sub = row.demand?.categorySubId;
    if (sub) interestSubs.add(sub);
  }
  return {
    subs,
    parents: new Set([...subs, ...interestSubs].map(parentOf)),
    interestSubs,
    followed: new Set(follows.map((f) => f.followingId)),
    likedAuthors: new Set(likedPosts.map((p) => p.senderId)),
    seenDemandIds: new Set(engaged.map((e) => e.demandId)),
  };
}

function nearScore(km: number | null): number {
  if (km == null) return 0;
  if (km <= 10) return 3;
  if (km <= 25) return 2;
  if (km <= 50) return 1;
  return 0;
}

const freshness = (createdAt: Date, now: number) => Math.max(0, 2 - (now - createdAt.getTime()) / (3.5 * DAY));

/** Weighted random sample without replacement; the same seed gives the same pick. */
function sample<T extends { id: string; weight: number }>(items: T[], seed: string, n: number): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(unitRandom(seed, item.id), 1 / Math.max(item.weight, 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.item);
}

/* ───────── Offers & requests ───────── */

export async function recommendDemands(opts: RecommendationOptions, signals?: ViewerSignals) {
  const s = signals ?? (await loadSignals(opts.viewerId));
  const now = new Date();
  const limit = opts.limit ?? RECOMMENDATION_LIMIT;
  const exclude = new Set(opts.excludeIds ?? []);
  const base: Prisma.DemandWhereInput = {
    status: { notIn: HIDDEN_FROM_FEED },
    timelineEnd: { gt: now },
    authorId: { not: opts.viewerId },
    author: { isBanned: false },
  };
  const nicheSubs = [...new Set([...s.subs, ...s.interestSubs])].slice(0, 60);

  // Three pools so niche and featured posts are always in the running, not only the newest.
  const [recent, niche, featured] = await Promise.all([
    prisma.demand.findMany({
      where: base,
      orderBy: { createdAt: "desc" },
      take: DEMAND_SCAN,
      select: { ...DEMAND_CARD_SELECT, _count: { select: { engagements: true } } },
    }),
    nicheSubs.length
      ? prisma.demand.findMany({
          where: { ...base, categorySubId: { in: nicheSubs } },
          orderBy: { createdAt: "desc" },
          take: DEMAND_SCAN,
          select: { ...DEMAND_CARD_SELECT, _count: { select: { engagements: true } } },
        })
      : Promise.resolve([]),
    prisma.demand.findMany({
      where: { ...base, isPriority: true, priorityExpiresAt: { gt: now } },
      orderBy: { priorityExpiresAt: "asc" },
      take: 60,
      select: { ...DEMAND_CARD_SELECT, _count: { select: { engagements: true } } },
    }),
  ]);

  const byId = new Map<string, (typeof recent)[number]>();
  for (const d of [...recent, ...niche, ...featured]) if (!exclude.has(d.id)) byId.set(d.id, d);

  const hasGeo = opts.lat != null && opts.lng != null;
  const scored = [...byId.values()].map((d) => {
    const km = hasGeo && d.lat != null && d.lng != null ? haversineKm(opts.lat!, opts.lng!, d.lat, d.lng) : null;
    const locationFree = !!d.serviceAreaType && (LOCATION_FREE_AREA_TYPES as string[]).includes(d.serviceAreaType);
    const isFeatured = d.isPriority && !!d.priorityExpiresAt && d.priorityExpiresAt > now;
    let weight = 1;
    if (d.categorySubId && s.subs.has(d.categorySubId)) weight += 4;
    else if (d.categoryParentId && s.parents.has(d.categoryParentId)) weight += 1.5;
    if (d.categorySubId && s.interestSubs.has(d.categorySubId)) weight += 3;
    if (s.followed.has(d.authorId)) weight += 2;
    if (isFeatured) weight += 3;
    weight += nearScore(km) + (hasGeo && locationFree ? 0.5 : 0);
    weight += Math.log1p(d._count.engagements) * 0.6;
    weight += freshness(d.createdAt, now.getTime());
    // Already opened: still possible, but let new things through first.
    if (s.seenDemandIds.has(d.id)) weight *= 0.4;
    return { id: d.id, weight, demand: d, km, isFeatured };
  });

  return sample(scored, opts.seed, limit).map(({ demand, km, isFeatured }) => {
    const { _count, ...card } = demand;
    const withKm = km == null ? card : { ...card, distanceKm: Math.round(km * 10) / 10 };
    // Only live featured posts keep the Featured look.
    return maskDemandAuthor({ ...withKm, isPriority: isFeatured }, { id: opts.viewerId });
  });
}

/* ───────── Feed posts ───────── */

export interface RecommendedPost {
  id: string;
  text: string;
  createdAt: Date;
  media: { url: string; contentType: string } | null;
  commentCount: number;
  reactionCount: number;
  distanceKm: number | null;
  author: { id: string; name: string; avatarUrl: string | null; username: string | null };
}

export async function recommendPosts(opts: RecommendationOptions, signals?: ViewerSignals): Promise<RecommendedPost[]> {
  const s = signals ?? (await loadSignals(opts.viewerId));
  const now = Date.now();
  const limit = opts.limit ?? RECOMMENDATION_LIMIT;
  const exclude = new Set(opts.excludeIds ?? []);
  const since = new Date(now - 30 * DAY);

  const posts = await prisma.forumMessage.findMany({
    where: { deletedAt: null, communityId: null, senderId: { not: opts.viewerId }, sender: { isBanned: false }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: POST_SCAN,
    select: {
      id: true,
      text: true,
      createdAt: true,
      lat: true,
      lng: true,
      senderId: true,
      sender: { select: { id: true, name: true, avatarUrl: true, username: true, categorySubIds: true } },
      attachments: { where: { status: "APPROVED" }, select: { url: true, contentType: true }, take: 1 },
      _count: { select: { comments: true } },
    },
  });
  const candidates = posts.filter((p) => !exclude.has(p.id));
  const reactionRows = candidates.length
    ? await prisma.forumReaction.groupBy({
        by: ["targetId"],
        where: { targetType: "MESSAGE", targetId: { in: candidates.map((p) => p.id) } },
        _count: { _all: true },
      })
    : [];
  const reactionsById = new Map(reactionRows.map((r) => [r.targetId, r._count._all]));

  const hasGeo = opts.lat != null && opts.lng != null;
  const scored = candidates.map((p) => {
    const km = hasGeo && p.lat != null && p.lng != null ? haversineKm(opts.lat!, opts.lng!, p.lat, p.lng) : null;
    const reactions = reactionsById.get(p.id) ?? 0;
    let weight = 1;
    if (s.followed.has(p.senderId)) weight += 3;
    if (s.likedAuthors.has(p.senderId)) weight += 2;
    if (p.sender.categorySubIds.some((sub) => s.subs.has(sub) || s.interestSubs.has(sub))) weight += 2;
    weight += nearScore(km);
    weight += Math.log1p(reactions) * 0.8 + Math.log1p(p._count.comments) * 0.8;
    weight += freshness(p.createdAt, now);
    if (p.attachments.length) weight += 0.5;
    return { id: p.id, weight, post: p, km, reactions };
  });

  return sample(scored, opts.seed, limit).map(({ post: p, km, reactions }) => ({
    id: p.id,
    text: p.text.slice(0, 220),
    createdAt: p.createdAt,
    media: p.attachments[0] ?? null,
    commentCount: p._count.comments,
    reactionCount: reactions,
    // Rounded only: exact coordinates never leave the server.
    distanceKm: km == null ? null : Math.max(1, Math.round(km)),
    author: { id: p.sender.id, name: p.sender.name, avatarUrl: p.sender.avatarUrl, username: p.sender.username },
  }));
}

/** Both kinds, interleaved (offer/request, post, …), `limit` in total. */
export async function recommendMixed(opts: RecommendationOptions) {
  const signals = await loadSignals(opts.viewerId);
  const limit = opts.limit ?? RECOMMENDATION_LIMIT;
  const [demands, posts] = await Promise.all([
    recommendDemands({ ...opts, limit }, signals),
    recommendPosts({ ...opts, limit }, signals),
  ]);
  type Item = { type: "demand"; demand: (typeof demands)[number] } | { type: "post"; post: RecommendedPost };
  const out: Item[] = [];
  let i = 0;
  let j = 0;
  // Half each, then whichever side has more fills the rest.
  while (out.length < limit && (i < demands.length || j < posts.length)) {
    const wantDemand = (out.length % 2 === 0 && i < demands.length) || j >= posts.length;
    if (wantDemand) out.push({ type: "demand", demand: demands[i++]! });
    else out.push({ type: "post", post: posts[j++]! });
  }
  return out;
}
