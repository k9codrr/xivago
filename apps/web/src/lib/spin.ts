import "server-only";
import crypto from "node:crypto";
import { prisma, applyCreditDelta } from "@/lib/db";
import type { Prisma, SpinKind } from "@slotbook/db";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A free spin unlocks this long after the previous free spin. */
export const FORTNIGHTLY_INTERVAL_MS = 14 * DAY_MS;
/** Buying this many slots within SLOT_BONUS_WINDOW_MS earns one bonus spin. */
export const SLOT_BONUS_SLOTS = 2;
export const SLOT_BONUS_WINDOW_MS = 7 * DAY_MS;

/**
 * Wheel segments in clockwise order, starting at 3 o'clock (the order the
 * wheel SVG draws them). `weight` is the relative chance of landing on it.
 */
export const SPIN_SEGMENTS = [
  { credits: 500, weight: 1 },
  { credits: 30, weight: 14 },
  { credits: 200, weight: 2 },
  { credits: 50, weight: 9 },
  { credits: 100, weight: 4 },
  { credits: 20, weight: 20 },
  { credits: 10, weight: 25 },
  { credits: 5, weight: 25 },
] as const;

export interface SpinStatus {
  /** Spin kinds available right now, in the order they'll be used. */
  available: SpinKind[];
  nextFreeSpinAt: string | null;
  /** Slots bought towards the next bonus spin (0..SLOT_BONUS_SLOTS). */
  bonusProgress: number;
  bonusSlotsNeeded: number;
  /** When the oldest counted slot drops out of the week window, if progress is partial. */
  bonusProgressExpiresAt: string | null;
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function getSpinStatus(db: Db, userId: string, now = new Date()): Promise<SpinStatus> {
  const [lastFree, lastBonus] = await Promise.all([
    db.spinWin.findFirst({ where: { userId, kind: "FORTNIGHTLY" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.spinWin.findFirst({ where: { userId, kind: "SLOT_BONUS" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);

  const nextFree = lastFree ? new Date(lastFree.createdAt.getTime() + FORTNIGHTLY_INTERVAL_MS) : now;
  const freeAvailable = nextFree <= now;

  // Only slots bought after the last bonus spin count, so each bonus needs fresh purchases
  const windowStart = new Date(now.getTime() - SLOT_BONUS_WINDOW_MS);
  const countFrom = lastBonus && lastBonus.createdAt > windowStart ? lastBonus.createdAt : windowStart;
  const recentSlots = await db.bid.findMany({
    where: { bidderId: userId, createdAt: { gt: countFrom } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
    take: SLOT_BONUS_SLOTS,
  });
  const bonusAvailable = recentSlots.length >= SLOT_BONUS_SLOTS;

  const available: SpinKind[] = [];
  if (freeAvailable) available.push("FORTNIGHTLY");
  if (bonusAvailable) available.push("SLOT_BONUS");

  return {
    available,
    nextFreeSpinAt: freeAvailable ? null : nextFree.toISOString(),
    bonusProgress: Math.min(recentSlots.length, SLOT_BONUS_SLOTS),
    bonusSlotsNeeded: SLOT_BONUS_SLOTS,
    bonusProgressExpiresAt:
      !bonusAvailable && recentSlots[0]
        ? new Date(recentSlots[0].createdAt.getTime() + SLOT_BONUS_WINDOW_MS).toISOString()
        : null,
  };
}

function pickSegment(): number {
  const total = SPIN_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = crypto.randomInt(total);
  for (let i = 0; i < SPIN_SEGMENTS.length; i++) {
    roll -= SPIN_SEGMENTS[i]!.weight;
    if (roll < 0) return i;
  }
  return SPIN_SEGMENTS.length - 1;
}

export class NoSpinAvailableError extends Error {
  constructor() {
    super("NO_SPIN_AVAILABLE");
    this.name = "NoSpinAvailableError";
  }
}

/** Uses one available spin, credits the prize, and returns where the wheel should stop. */
export async function spinWheel(userId: string) {
  return prisma.$transaction(async (tx) => {
    // Row lock: two taps on "Spin" can't both see the same spin as available
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;

    const status = await getSpinStatus(tx, userId);
    const kind = status.available[0];
    if (!kind) throw new NoSpinAvailableError();

    const segmentIndex = pickSegment();
    const amount = SPIN_SEGMENTS[segmentIndex]!.credits;

    await tx.spinWin.create({ data: { userId, kind, amount } });
    const { balance } = await applyCreditDelta(tx, { userId, amount, type: "GRANT", note: `spin-win:${kind}` });

    return { segmentIndex, amount, kind, balance, status: await getSpinStatus(tx, userId) };
  });
}
