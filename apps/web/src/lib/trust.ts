import "server-only";
import { prisma, type Prisma, type TrustRole, type TrustTier, type DealProgress } from "@/lib/db";
import { TIER_ORDER, type BadgeCode } from "@/lib/trust-labels";

/**
 * Trust tiers & pills. Rebuilt monthly (1st, 00:05 IST) from paid, completed
 * deals; ratings themselves stay live (lib ratings summary). See the comment
 * block above `enum TrustRole` in schema.prisma.
 */

type Tx = Prisma.TransactionClient;

const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const WARNING_DAYS = 30;
/** Monthly runs can be 28 days apart; a warning counts as "at the next run" within this slack. */
const WARNING_SLACK_MS = 3 * DAY;
const MAX_DEALS_PER_PARTNER = 3;
const BURST_WINDOW_MS = 7 * DAY;
const BURST_MAX = 3;
const MIN_RATER_AGE_MS = 7 * DAY;

export const TIER_RULES: Record<Exclude<TrustTier, "NEW">, { deals: number; rating: number; partners: number }> = {
  BRONZE: { deals: 3, rating: 3.5, partners: 2 },
  SILVER: { deals: 10, rating: 4.0, partners: 5 },
  GOLD: { deals: 25, rating: 4.5, partners: 10 },
};

/** Statuses that mean "this deal didn't really happen (or went wrong)". */
const BLOCKING_PROGRESS: DealProgress[] = ["NOT_STARTED", "CANCELLED", "PROBLEM"];

const ROLES: TrustRole[] = ["VENDOR", "SEEKER"];
const PILLS: BadgeCode[] = ["VERIFIED", "FAST_RESPONDER", "ON_TIME", "REPEAT_CLIENTS"];

// ── Deals ───────────────────────────────────────────────────────────────

interface RatingRow {
  raterId: string;
  direction: "SEEKER_TO_VENDOR" | "VENDOR_TO_SEEKER";
  responsiveness: number;
  quality: number;
  timeliness: number;
  value: number;
}

interface Deal {
  bidId: string;
  vendorId: string;
  seekerId: string;
  pairKey: string;
  completedAt: Date;
  /** Rating the seeker gave the vendor (always present for a completed deal). */
  vendorRating: RatingRow;
  /** Rating the vendor gave the seeker, if any. */
  seekerRating: RatingRow | null;
  fraud: string | null;
}

const avg4 = (r: RatingRow) => (r.responsiveness + r.quality + r.timeliness + r.value) / 4;

/**
 * Paid, completed deals: slot payment captured and not refunded, the seeker
 * has rated the vendor, and neither side's latest check-in says it never
 * started / was cancelled / has a problem. Fraud checks flag (not drop) deals
 * so the excluded count is visible in role_stats.
 */
async function completedDeals(): Promise<Deal[]> {
  const bids = await prisma.bid.findMany({
    select: {
      id: true,
      bidderId: true,
      paymentId: true,
      demand: { select: { authorId: true } },
      ratings: {
        select: {
          raterId: true,
          direction: true,
          responsiveness: true,
          quality: true,
          timeliness: true,
          value: true,
          createdAt: true,
          rater: { select: { createdAt: true } },
        },
      },
      checkInStates: { select: { latestStatus: true } },
    },
  });
  const payments = await prisma.payment.findMany({
    where: { id: { in: bids.map((b) => b.paymentId) } },
    select: { id: true, status: true, refundedAt: true },
  });
  const paid = new Set(payments.filter((p) => p.status === "CAPTURED" && !p.refundedAt).map((p) => p.id));

  const userIds = [...new Set(bids.flatMap((b) => [b.bidderId, b.demand.authorId]))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true, isBanned: true, referredById: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  const deals: Deal[] = [];
  for (const b of bids) {
    const vendorId = b.bidderId;
    const seekerId = b.demand.authorId;
    if (vendorId === seekerId || !paid.has(b.paymentId)) continue;
    const vendorRating = b.ratings.find((r) => r.direction === "SEEKER_TO_VENDOR");
    if (!vendorRating) continue;
    if (b.checkInStates.some((s) => s.latestStatus && BLOCKING_PROGRESS.includes(s.latestStatus))) continue;

    const v = byId.get(vendorId);
    const s = byId.get(seekerId);
    let fraud: string | null = null;
    if (!v || !s) fraud = "missing-user";
    else if (v.isBanned || s.isBanned) fraud = "banned";
    else if (v.phone && s.phone && v.phone === s.phone) fraud = "shared-phone";
    else if (v.referredById === s.id || s.referredById === v.id) fraud = "referral-link";
    else if (vendorRating.createdAt.getTime() - vendorRating.rater.createdAt.getTime() < MIN_RATER_AGE_MS) fraud = "new-rater";

    deals.push({
      bidId: b.id,
      vendorId,
      seekerId,
      pairKey: [vendorId, seekerId].sort().join(":"),
      completedAt: vendorRating.createdAt,
      vendorRating,
      seekerRating: b.ratings.find((r) => r.direction === "VENDOR_TO_SEEKER") ?? null,
      fraud,
    });
  }

  // Burst check: more than 3 deals between the same pair inside any 7-day window.
  const byPair = new Map<string, Deal[]>();
  for (const d of deals) byPair.set(d.pairKey, [...(byPair.get(d.pairKey) ?? []), d]);
  for (const list of byPair.values()) {
    list.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
    for (let i = 0; i < list.length; i++) {
      let j = i;
      while (j + 1 < list.length && list[j + 1]!.completedAt.getTime() - list[i]!.completedAt.getTime() <= BURST_WINDOW_MS) j++;
      if (j - i + 1 > BURST_MAX) for (let k = i; k <= j; k++) list[k]!.fraud ??= "pair-burst";
    }
  }
  return deals;
}

// ── Stats ───────────────────────────────────────────────────────────────

interface Stats {
  completedDeals: number;
  distinctPartners: number;
  repeatPartners: number;
  ratingCount: number;
  avgRating: number | null;
  avgResponsiveness: number | null;
  avgTimeliness: number | null;
  excludedDeals: number;
}

interface UserAgg {
  roles: Record<TrustRole, Stats>;
  /** Pills look at both roles together. */
  ratings: RatingRow[];
  partnerDeals: Map<string, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function buildStats(deals: Deal[]): Map<string, UserAgg> {
  // 3-deals-per-partner cap: per pair, only the first three (by completion) count.
  const counted: Deal[] = [];
  const perPair = new Map<string, number>();
  for (const d of [...deals].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())) {
    if (d.fraud) continue;
    const n = perPair.get(d.pairKey) ?? 0;
    if (n >= MAX_DEALS_PER_PARTNER) continue;
    perPair.set(d.pairKey, n + 1);
    counted.push(d);
  }

  type Acc = { deals: number; partners: Map<string, number>; ratings: RatingRow[]; excluded: number };
  const acc = new Map<string, Record<TrustRole, Acc>>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) {
      const blank = (): Acc => ({ deals: 0, partners: new Map(), ratings: [], excluded: 0 });
      a = { VENDOR: blank(), SEEKER: blank() };
      acc.set(id, a);
    }
    return a;
  };

  for (const d of deals) {
    if (!d.fraud) continue;
    get(d.vendorId).VENDOR.excluded++;
    get(d.seekerId).SEEKER.excluded++;
  }
  for (const d of counted) {
    const v = get(d.vendorId).VENDOR;
    v.deals++;
    v.partners.set(d.seekerId, (v.partners.get(d.seekerId) ?? 0) + 1);
    v.ratings.push(d.vendorRating);

    const s = get(d.seekerId).SEEKER;
    s.deals++;
    s.partners.set(d.vendorId, (s.partners.get(d.vendorId) ?? 0) + 1);
    if (d.seekerRating) s.ratings.push(d.seekerRating);
  }

  const out = new Map<string, UserAgg>();
  for (const [userId, roles] of acc) {
    const toStats = (a: Acc): Stats => ({
      completedDeals: a.deals,
      distinctPartners: a.partners.size,
      repeatPartners: [...a.partners.values()].filter((n) => n >= 2).length,
      ratingCount: a.ratings.length,
      avgRating: mean(a.ratings.map(avg4)),
      avgResponsiveness: mean(a.ratings.map((r) => r.responsiveness)),
      avgTimeliness: mean(a.ratings.map((r) => r.timeliness)),
      excludedDeals: a.excluded,
    });
    const partnerDeals = new Map<string, number>();
    for (const r of ROLES) for (const [p, n] of roles[r].partners) partnerDeals.set(p, (partnerDeals.get(p) ?? 0) + n);
    out.set(userId, {
      roles: { VENDOR: toStats(roles.VENDOR), SEEKER: toStats(roles.SEEKER) },
      ratings: [...roles.VENDOR.ratings, ...roles.SEEKER.ratings],
      partnerDeals,
    });
  }
  return out;
}

export function qualifiedTier(s: Pick<Stats, "completedDeals" | "avgRating" | "distinctPartners"> | undefined): TrustTier {
  if (!s || s.avgRating == null) return "NEW";
  for (const tier of ["GOLD", "SILVER", "BRONZE"] as const) {
    const r = TIER_RULES[tier];
    if (s.completedDeals >= r.deals && s.avgRating >= r.rating && s.distinctPartners >= r.partners) return tier;
  }
  return "NEW";
}

function qualifiedPills(agg: UserAgg | undefined, isVerified: boolean): Set<BadgeCode> {
  const pills = new Set<BadgeCode>();
  if (isVerified) pills.add("VERIFIED");
  if (!agg) return pills;
  const n = agg.ratings.length;
  if (n >= 5 && (mean(agg.ratings.map((r) => r.responsiveness)) ?? 0) >= 4.5) pills.add("FAST_RESPONDER");
  if (n >= 5 && (mean(agg.ratings.map((r) => r.timeliness)) ?? 0) >= 4.5) pills.add("ON_TIME");
  if ([...agg.partnerDeals.values()].filter((x) => x >= 2).length >= 3) pills.add("REPEAT_CLIENTS");
  return pills;
}

// ── Apply ───────────────────────────────────────────────────────────────

const rank = (t: TrustTier) => TIER_ORDER.indexOf(t);

async function logEvent(tx: Tx, userId: string, event: "AWARDED" | "WARNED" | "DOWNGRADED" | "RESET", reason: string) {
  await tx.badgeEvent.create({ data: { userId, event, reason } });
}

async function notify(tx: Tx, phone: string | null, templateName: string, payload: Prisma.InputJsonValue) {
  if (!phone) return;
  await tx.notificationLog.create({ data: { toPhone: phone, templateName, status: "QUEUED", payload } });
}

interface Counters {
  upgraded: number;
  warned: number;
  downgraded: number;
  reset: number;
  pillsAwarded: number;
  pillsRevoked: number;
}

async function applyUser(
  user: { id: string; phone: string | null; isVerified: boolean; isBanned: boolean },
  agg: UserAgg | undefined,
  now: Date,
  c: Counters,
) {
  await prisma.$transaction(async (tx) => {
    const trustRows = await tx.userTrust.findMany({ where: { userId: user.id } });
    const activeBadges = await tx.userBadge.findMany({ where: { userId: user.id, revokedAt: null } });

    // Banned: everything back to zero at once, no grace period.
    if (user.isBanned) {
      const hadAny = trustRows.some((t) => t.tier !== "NEW" || t.warningTier) || activeBadges.length > 0;
      if (!hadAny) return;
      await tx.userTrust.updateMany({ where: { userId: user.id }, data: { tier: "NEW", tierSince: now, warningTier: null, warningUntil: null } });
      await tx.userBadge.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now, warningUntil: null } });
      await logEvent(tx, user.id, "RESET", "account-banned");
      c.reset++;
      return;
    }

    const warningDue = (until: Date | null) => until != null && now.getTime() >= until.getTime() - WARNING_SLACK_MS;
    const newWarning = () => new Date(now.getTime() + WARNING_DAYS * DAY);

    for (const role of ROLES) {
      const stats = agg?.roles[role];
      if (stats) {
        await tx.roleStats.upsert({
          where: { userId_role: { userId: user.id, role } },
          update: { ...stats, computedAt: now },
          create: { userId: user.id, role, ...stats, computedAt: now },
        });
      } else {
        await tx.roleStats.deleteMany({ where: { userId: user.id, role } });
      }

      const q = qualifiedTier(stats);
      const row = trustRows.find((t) => t.role === role);
      const cur = row?.tier ?? "NEW";
      if (!row && q === "NEW") continue;
      const where = { userId_role: { userId: user.id, role } };

      if (rank(q) > rank(cur)) {
        await tx.userTrust.upsert({
          where,
          update: { tier: q, tierSince: now, warningTier: null, warningUntil: null },
          create: { userId: user.id, role, tier: q, tierSince: now },
        });
        await logEvent(tx, user.id, "AWARDED", `tier:${role}:${cur}->${q}`);
        await notify(tx, user.phone, "trust_tier_upgraded", { role, from: cur, to: q });
        c.upgraded++;
      } else if (rank(q) < rank(cur)) {
        if (row?.warningUntil && warningDue(row.warningUntil)) {
          const dropped = TIER_ORDER[rank(cur) - 1]!;
          const stillLower = rank(q) < rank(dropped);
          await tx.userTrust.update({
            where,
            data: {
              tier: dropped,
              tierSince: now,
              warningTier: stillLower ? q : null,
              warningUntil: stillLower ? newWarning() : null,
            },
          });
          await logEvent(tx, user.id, "DOWNGRADED", `tier:${role}:${cur}->${dropped}`);
          await notify(tx, user.phone, "trust_tier_downgraded", { role, from: cur, to: dropped });
          c.downgraded++;
          if (stillLower) {
            await logEvent(tx, user.id, "WARNED", `tier:${role}:${dropped}:qualifies-for-${q}`);
            c.warned++;
          }
        } else if (!row?.warningUntil) {
          const until = newWarning();
          await tx.userTrust.update({ where, data: { warningTier: q, warningUntil: until } });
          await logEvent(tx, user.id, "WARNED", `tier:${role}:${cur}:qualifies-for-${q}`);
          await notify(tx, user.phone, "trust_tier_warning", { role, tier: cur, qualifiesFor: q, until: until.toISOString() });
          c.warned++;
        } else if (row.warningTier !== q) {
          // Still in the grace period; just track what they qualify for now.
          await tx.userTrust.update({ where, data: { warningTier: q } });
        }
      } else if (row?.warningUntil) {
        // Back up to their tier during the grace period.
        await tx.userTrust.update({ where, data: { warningTier: null, warningUntil: null } });
      }
    }

    const qualifies = qualifiedPills(agg, user.isVerified);
    for (const code of PILLS) {
      const active = activeBadges.find((b) => b.badgeCode === code);
      if (qualifies.has(code)) {
        if (!active) {
          await tx.userBadge.create({ data: { userId: user.id, badgeCode: code, awardedAt: now } });
          await logEvent(tx, user.id, "AWARDED", `badge:${code}`);
          c.pillsAwarded++;
        } else if (active.warningUntil) {
          await tx.userBadge.update({ where: { id: active.id }, data: { warningUntil: null } });
        }
      } else if (active) {
        // Verification is an admin decision, so it comes off at once.
        if (code === "VERIFIED" || warningDue(active.warningUntil)) {
          await tx.userBadge.update({ where: { id: active.id }, data: { revokedAt: now, warningUntil: null } });
          await logEvent(tx, user.id, "DOWNGRADED", `badge:${code}:revoked`);
          c.pillsRevoked++;
        } else if (!active.warningUntil) {
          await tx.userBadge.update({ where: { id: active.id }, data: { warningUntil: newWarning() } });
          await logEvent(tx, user.id, "WARNED", `badge:${code}`);
          c.warned++;
        }
      }
    }
  });
}

/** "2026-11" for the IST month containing `d`. */
export function istMonthKey(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

export function isFirstOfMonthIst(d: Date): boolean {
  return new Date(d.getTime() + IST_OFFSET_MS).getUTCDate() === 1;
}

/**
 * The monthly rebuild. The cron fires daily and this only does work on the
 * 1st (IST) and once per month; `force` (admin "Run now") skips both guards.
 * Warnings still need ~30 days to mature, so forced re-runs can't downgrade
 * anyone early.
 */
export async function runTrustJob({ force = false }: { force?: boolean } = {}) {
  const now = new Date();
  const month = istMonthKey(now);
  if (!force) {
    if (!isFirstOfMonthIst(now)) return { ran: false, reason: "not-first-of-month" };
    if (await prisma.trustJobRun.findUnique({ where: { month } })) return { ran: false, reason: "already-ran", month };
  }

  const deals = await completedDeals();
  const aggs = buildStats(deals);

  const involved = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: [...aggs.keys()] } },
        { isVerified: true },
        { trust: { some: {} } },
        { roleStats: { some: {} } },
        { badges: { some: { revokedAt: null } } },
      ],
    },
    select: { id: true, phone: true, isVerified: true, isBanned: true },
  });

  const c: Counters = { upgraded: 0, warned: 0, downgraded: 0, reset: 0, pillsAwarded: 0, pillsRevoked: 0 };
  for (const u of involved) await applyUser(u, aggs.get(u.id), now, c);

  const stats = {
    users: involved.length,
    completedDeals: deals.length,
    fraudExcluded: deals.filter((d) => d.fraud).length,
    ...c,
  };
  await prisma.trustJobRun.upsert({ where: { month }, update: { ranAt: now, stats }, create: { month, ranAt: now, stats } });
  return { ran: true, month, ...stats };
}

// ── Display ─────────────────────────────────────────────────────────────

export async function getUserTrust(userId: string) {
  const [tiers, badges] = await Promise.all([
    prisma.userTrust.findMany({ where: { userId }, select: { role: true, tier: true, tierSince: true } }),
    prisma.userBadge.findMany({
      where: { userId, revokedAt: null },
      select: { badgeCode: true, awardedAt: true },
      orderBy: { awardedAt: "asc" },
    }),
  ]);
  return { tiers, badges: badges.map((b) => b.badgeCode as BadgeCode) };
}
