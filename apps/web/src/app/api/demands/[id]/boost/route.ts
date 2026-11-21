import { NextRequest, NextResponse } from "next/server";
import { prisma, applyCreditDelta, InsufficientCreditsError } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { authorizeCreditSpend, createInvoice, CreditPaymentError } from "@/lib/credit-payment";
import { getBoostSettings } from "@/lib/boost";
import { boostEndsAt, boostLimits, boostModeFor, isBoostActive } from "@/lib/boost-shared";
import { boostRequestSchema } from "@/lib/validation/boost";

/**
 * Feature a post for N days (pricePerDay x N credits), or extend a post that
 * was featured before. Extending a running boost adds the days to its current
 * end; extending one that already ended starts again from now. If the post's
 * own "connect by" deadline is earlier than the boost end, it is pushed out so
 * the post stays visible for every paid day. A post that expired on its own
 * (deadline passed) is reopened by an extension; one closed by the author,
 * filled, or expired by an admin is not.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const parsed = boostRequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { days, auth } = parsed.data;

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        status: true,
        isPriority: true,
        priorityExpiresAt: true,
        timelineEnd: true,
        summary: true,
        maxSlots: true,
        _count: { select: { bids: true } },
      },
    });
    if (!demand) return apiError(404, "NOT_FOUND", "This post doesn't exist.");
    if (demand.authorId !== user.id) {
      return apiError(403, "FORBIDDEN", "Only the person who posted this can feature it.");
    }

    const now = new Date();
    const mode = boostModeFor(demand.priorityExpiresAt);
    const deadlinePassed = demand.timelineEnd <= now;
    const naturallyExpired = (demand.status === "EXPIRED" || demand.status === "OPEN") && deadlinePassed;
    const reopen = mode === "extend" && naturallyExpired && demand._count.bids < demand.maxSlots;

    if (demand.status !== "OPEN" && !reopen) {
      return apiError(409, "CONFLICT", "This post is closed and can't be featured.");
    }
    if (deadlinePassed && !reopen) {
      return apiError(409, "CONFLICT", "This post has ended and can't be featured.");
    }

    const settings = await getBoostSettings();
    const { pricePerDay, minDays, maxDays } = boostLimits(settings, mode);
    if (days < minDays || days > maxDays) {
      return apiError(
        400,
        "INVALID_DAYS",
        `${mode === "extend" ? "Extensions" : "Featured boosts"} run from ${minDays} to ${maxDays} days.`,
      );
    }
    const cost = pricePerDay * days;

    const running = isBoostActive(demand.isPriority, demand.priorityExpiresAt, now.getTime());
    const endsAt = boostEndsAt(days, running ? demand.priorityExpiresAt : null, now.getTime());
    const timelineEnd = demand.timelineEnd > endsAt ? demand.timelineEnd : endsAt;

    await authorizeCreditSpend(user.id, auth, cost);

    try {
      const { updated, invoice } = await prisma.$transaction(async (tx) => {
        await applyCreditDelta(tx, {
          userId: user.id,
          amount: -cost,
          type: "BOOST",
          demandId: demand.id,
          note: mode === "extend" ? `priority-boost-extend-${days}d` : `priority-boost-${days}d`,
        });
        const updated = await tx.demand.update({
          where: { id: demand.id },
          data: { isPriority: true, priorityExpiresAt: endsAt, timelineEnd, status: "OPEN" },
          select: { id: true, isPriority: true, priorityExpiresAt: true, timelineEnd: true, status: true },
        });
        const invoice = await createInvoice(tx, {
          userId: user.id,
          kind: "PRIORITY_BOOST",
          title: demand.summary,
          items: [
            {
              label: `${mode === "extend" ? "Featured extension" : "Featured boost"} · ${days} day${days === 1 ? "" : "s"} × ${pricePerDay}`,
              credits: cost,
            },
          ],
          demandId: demand.id,
        });
        return { updated, invoice };
      });

      return NextResponse.json({ demand: updated, invoice, mode, days, cost });
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return apiError(402, "INSUFFICIENT_CREDITS", `This costs ${cost} credits — you don't have enough.`);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof CreditPaymentError) return err.toResponse();
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands/boost: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not feature this post.");
  }
}
