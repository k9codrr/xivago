import type { Prisma, PrismaClient } from "@prisma/client";

export const FREE_DEMANDS_PER_MONTH = 3;

type QueryClient = Prisma.TransactionClient | PrismaClient;

export interface MonthlyQuota {
  used: number;
  limit: number;
  remaining: number;
  /** Start of the *next* UTC calendar month — when the quota resets. */
  resetsAt: Date;
}

/**
 * "3 free demands per calendar month" (§3.3), counted as
 * `COUNT(*) WHERE authorId = ? AND createdAt IN [start of this UTC month, now)`.
 * See DECISIONS.md #7 — "calendar month" is defined in UTC, not the
 * author's local timezone, since there's no per-user timezone in the
 * schema.
 */
export async function getMonthlyDemandQuota(
  db: QueryClient,
  userId: string,
): Promise<MonthlyQuota> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const used = await db.demand.count({
    where: {
      authorId: userId,
      createdAt: { gte: monthStart, lt: nextMonthStart },
    },
  });

  return {
    used,
    limit: FREE_DEMANDS_PER_MONTH,
    remaining: Math.max(0, FREE_DEMANDS_PER_MONTH - used),
    resetsAt: nextMonthStart,
  };
}
