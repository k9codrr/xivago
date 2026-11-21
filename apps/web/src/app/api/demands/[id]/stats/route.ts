import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { demandEngagementSchema } from "@/lib/validation/demand";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Records that a viewer opened a demand and returns its statistics. The poster's
 * own opens are not counted. Tracking never blocks the numbers: if recording
 * fails, the viewer still gets the stats.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: demandId } = await params;

  const parsed = demandEngagementSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { kinds, anonId } = parsed.data;

  const user = await getOptionalUser();
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    select: { authorId: true, status: true },
  });
  if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

  const isHidden = HIDDEN_FROM_FEED.includes(demand.status);
  if (isHidden && !user?.isAdmin) return apiError(410, "GONE", "This request is no longer available.");

  const today = startOfUtcDay(new Date());
  const viewerKey = user ? `u:${user.id}` : anonId ? `a:${anonId}` : null;

  if (viewerKey && !isHidden && user?.id !== demand.authorId) {
    try {
      await Promise.all(
        Array.from(new Set(kinds)).map((kind) =>
          prisma.demandEngagement.upsert({
            where: { demandId_kind_viewerKey_day: { demandId, kind, viewerKey, day: today } },
            create: { demandId, kind, viewerKey, day: today },
            update: { count: { increment: 1 } },
          }),
        ),
      );
    } catch (err) {
      console.error("demands/stats: could not record engagement", err);
    }
  }

  const viewWhere = { demandId, kind: "VIEW" as const };
  const [views, viewsToday, viewers, clicks, saves, chats] = await Promise.all([
    prisma.demandEngagement.count({ where: viewWhere }),
    prisma.demandEngagement.count({ where: { ...viewWhere, day: today } }),
    prisma.demandEngagement.groupBy({ by: ["viewerKey"], where: viewWhere }),
    prisma.demandEngagement.aggregate({ where: { demandId, kind: "CARD_CLICK" }, _sum: { count: true } }),
    prisma.bookmark.count({ where: { demandId } }),
    prisma.conversation.count({ where: { demandId } }),
  ]);

  return NextResponse.json({
    stats: {
      views,
      uniqueViewers: viewers.length,
      viewsToday,
      cardClicks: clicks._sum.count ?? 0,
      saves,
      chats,
    },
  });
}
