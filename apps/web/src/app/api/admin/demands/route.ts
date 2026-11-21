import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** All demands including EXPIRED/FILLED/CANCELLED -- section 3.12: "Demands: all incl. EXPIRED, force-expire, delete." */
export async function GET() {
  try {
    await requireAdmin();

    const demands = await prisma.demand.findMany({
      select: {
        id: true,
        summary: true,
        status: true,
        isPriority: true,
        timelineEnd: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
        _count: { select: { bids: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ demands });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load posts.");
  }
}
