import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { HIDDEN_FROM_FEED } from "@/lib/demand-access";
import { apiError } from "@/lib/api-response";

/** Demands tab on a public profile -- OPEN demands only for other viewers (same visibility rule as the feed, §3.8); the author/admin see everything. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOptionalUser();

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

  const isOwnerOrAdmin = viewer?.id === id || Boolean(viewer?.isAdmin);

  const demands = await prisma.demand.findMany({
    where: { authorId: id, ...(isOwnerOrAdmin ? {} : { status: { notIn: HIDDEN_FROM_FEED } }) },
    select: {
      id: true,
      summary: true,
      budgetMin: true,
      budgetMax: true,
      status: true,
      isPriority: true,
      timelineEnd: true,
      createdAt: true,
      _count: { select: { bids: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ demands });
}
