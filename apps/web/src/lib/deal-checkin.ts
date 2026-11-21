import "server-only";
import { prisma, type DealProgress } from "@/lib/db";

/**
 * In-chat "how's the project going?" check-ins on a paid slot. Each side is
 * asked independently at randomised times; the answers feed the trust job
 * (a deal only counts as completed if neither side's latest answer says it
 * didn't happen or went wrong — see completedDeals() in lib/trust.ts).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Random delay between `minDays` and `maxDays`, at a random hour. */
function randomDelay(minDays: number, maxDays: number): number {
  return Math.round((minDays + Math.random() * (maxDays - minDays)) * DAY);
}

/** When to ask again after each answer; null = stop asking. */
const NEXT_ASK: Record<DealProgress, [number, number] | null> = {
  NOT_STARTED: [2, 4],
  IN_PROGRESS: [3, 6],
  PROBLEM: [2, 3],
  COMPLETED: null,
  CANCELLED: null,
};

export class CheckInAccessError extends Error {}

async function loadBid(bidId: string, userId: string) {
  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    select: {
      id: true,
      createdAt: true,
      paymentId: true,
      bidderId: true,
      bidder: { select: { id: true, name: true, avatarUrl: true, companyName: true } },
      demand: {
        select: {
          id: true,
          summary: true,
          authorId: true,
          author: { select: { id: true, name: true, avatarUrl: true, companyName: true } },
        },
      },
    },
  });
  if (!bid) throw new CheckInAccessError("This engagement doesn't exist.");
  const isVendor = bid.bidderId === userId;
  const isSeeker = bid.demand.authorId === userId;
  if (!isVendor && !isSeeker) throw new CheckInAccessError("You weren't part of this engagement.");
  const payment = await prisma.payment.findUnique({ where: { id: bid.paymentId }, select: { status: true, refundedAt: true } });
  const paid = payment?.status === "CAPTURED" && !payment.refundedAt;
  return { bid, isVendor, paid, other: isVendor ? bid.demand.author : bid.bidder };
}

export async function getCheckIn(userId: string, bidId: string) {
  const { bid, isVendor, paid, other } = await loadBid(bidId, userId);

  let state = await prisma.dealCheckInState.findUnique({ where: { bidId_userId: { bidId, userId } } });
  if (!state) {
    // First ask lands 1–3 days after the slot was bought, at a random time.
    state = await prisma.dealCheckInState.upsert({
      where: { bidId_userId: { bidId, userId } },
      update: {},
      create: { bidId, userId, nextAskAt: new Date(bid.createdAt.getTime() + randomDelay(1, 3)) },
    });
  }
  const [rated, history] = await Promise.all([
    prisma.rating.count({ where: { bidId, raterId: userId } }),
    prisma.dealCheckIn.findMany({
      where: { bidId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { userId: true, status: true, createdAt: true },
    }),
  ]);
  const otherLatest = history.find((h) => h.userId === other.id)?.status ?? null;

  return {
    bidId,
    role: isVendor ? ("VENDOR" as const) : ("SEEKER" as const),
    due: paid && state.nextAskAt != null && state.nextAskAt.getTime() <= Date.now(),
    latestStatus: state.latestStatus,
    otherLatestStatus: otherLatest,
    rated: rated > 0,
    demandSummary: bid.demand.summary,
    otherParty: other,
  };
}

export async function answerCheckIn(
  userId: string,
  bidId: string,
  input: { snooze: true } | { status: DealProgress; mood?: number | null; note?: string | null },
) {
  const { paid, other } = await loadBid(bidId, userId);
  if (!paid) throw new CheckInAccessError("This response spot isn't paid, so there's nothing to check in on.");
  const key = { bidId_userId: { bidId, userId } };

  if ("snooze" in input) {
    const nextAskAt = new Date(Date.now() + randomDelay(1, 1.5));
    await prisma.dealCheckInState.upsert({ where: key, update: { nextAskAt }, create: { bidId, userId, nextAskAt } });
    return { ok: true as const };
  }

  const delay = NEXT_ASK[input.status];
  const nextAskAt = delay ? new Date(Date.now() + randomDelay(delay[0], delay[1])) : null;
  await prisma.$transaction(async (tx) => {
    await tx.dealCheckIn.create({
      data: { bidId, userId, status: input.status, mood: input.mood ?? null, note: input.note?.trim() || null },
    });
    await tx.dealCheckInState.upsert({
      where: key,
      update: { latestStatus: input.status, nextAskAt },
      create: { bidId, userId, latestStatus: input.status, nextAskAt },
    });
    // A final answer from one side prompts the other side to confirm on their next visit.
    if (input.status === "COMPLETED" || input.status === "CANCELLED") {
      const otherKey = { bidId_userId: { bidId, userId: other.id } };
      const otherState = await tx.dealCheckInState.findUnique({ where: otherKey });
      if (!otherState) {
        await tx.dealCheckInState.create({ data: { bidId, userId: other.id, nextAskAt: new Date() } });
      } else if (otherState.latestStatus !== input.status) {
        await tx.dealCheckInState.update({ where: otherKey, data: { nextAskAt: new Date() } });
      }
    }
  });
  return { ok: true as const };
}
