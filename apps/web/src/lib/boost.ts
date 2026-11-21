import "server-only";
import { prisma } from "@/lib/db";
import type { BoostConfig } from "@/lib/boost-shared";

export async function getBoostSettings(): Promise<BoostConfig & { updatedAt: Date }> {
  const row = await prisma.boostSettings.upsert({ where: { id: "global" }, update: {}, create: { id: "global" } });
  return {
    pricePerDay: row.pricePerDay,
    minDays: row.minDays,
    maxDays: row.maxDays,
    extendPricePerDay: row.extendPricePerDay,
    extendMinDays: row.extendMinDays,
    extendMaxDays: row.extendMaxDays,
    updatedAt: row.updatedAt,
  };
}

const EXPIRE_EVERY_MS = 60_000;
let lastExpiredAt = 0;

/**
 * Un-feature posts whose paid days have run out, so the feed's
 * `isPriority desc` ordering only lifts live boosts. Called from the feed
 * routes (at most once a minute per server instance) and the expiry cron.
 * `priorityExpiresAt` is kept, which is how an ended boost can be extended.
 */
export async function expireStaleBoosts(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastExpiredAt < EXPIRE_EVERY_MS) return 0;
  lastExpiredAt = now;
  try {
    const { count } = await prisma.demand.updateMany({
      where: { isPriority: true, OR: [{ priorityExpiresAt: { lte: new Date(now) } }, { priorityExpiresAt: null }] },
      data: { isPriority: false },
    });
    return count;
  } catch (err) {
    console.error("boost: could not expire stale boosts", (err as Error).message);
    return 0;
  }
}
