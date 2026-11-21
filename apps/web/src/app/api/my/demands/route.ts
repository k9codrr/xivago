import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { expireStaleBoosts } from "@/lib/boost";

export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleBoosts();

    const demands = await prisma.demand.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        summary: true,
        budgetMin: true,
        budgetMax: true,
        currency: true,
        timelineEnd: true,
        status: true,
        isPriority: true,
        priorityExpiresAt: true,
        maxSlots: true,
        shareContact: true,
        createdAt: true,
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ demands });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("my/demands: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load your posts.");
  }
}
