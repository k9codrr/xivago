import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { expireStaleBoosts } from "@/lib/boost";

const EXPIRY_WARNING_WINDOW_MS = 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return apiError(401, "UNAUTHORIZED", "Missing or invalid cron secret.");
  }

  const now = new Date();

  // 1) Expire anything OPEN whose timeline has passed.
  const expired = await prisma.demand.updateMany({
    where: { status: "OPEN", timelineEnd: { lt: now } },
    data: { status: "EXPIRED" },
  });

  // 1b) Un-feature posts whose paid featured days have ended.
  const boostsEnded = await expireStaleBoosts(true);

  // 2) Queue "demand_expiring" notifications for OPEN demands expiring
  // within the next 24h that haven't already been queued. Actual sending
  // is wired up in M6 (@slotbook/whatsapp isn't implemented yet) — this
  // just creates the QUEUED NotificationLog row so nothing is missed once
  // it is. See DECISIONS.md #19.
  const expiringSoon = await prisma.demand.findMany({
    where: {
      status: "OPEN",
      timelineEnd: { gt: now, lte: new Date(now.getTime() + EXPIRY_WARNING_WINDOW_MS) },
    },
    select: { id: true, authorId: true, summary: true, timelineEnd: true, author: { select: { phone: true } } },
  });

  let queued = 0;
  for (const demand of expiringSoon) {
    if (!demand.author.phone) continue; // nothing to notify without a verified phone

    const alreadyQueued = await prisma.notificationLog.findFirst({
      where: {
        templateName: "demand_expiring",
        payload: { path: ["demandId"], equals: demand.id },
      },
      select: { id: true },
    });
    if (alreadyQueued) continue;

    const filledCount = await prisma.bid.count({ where: { demandId: demand.id } });

    await prisma.notificationLog.create({
      data: {
        toPhone: demand.author.phone,
        templateName: "demand_expiring",
        status: "QUEUED",
        payload: {
          demandId: demand.id,
          summary: demand.summary,
          slotsFilled: filledCount,
          timelineEnd: demand.timelineEnd.toISOString(),
        },
      },
    });
    queued += 1;
  }

  return NextResponse.json({
    ok: true,
    expiredCount: expired.count,
    boostsEnded,
    notificationsQueued: queued,
    ranAt: now.toISOString(),
  });
}
