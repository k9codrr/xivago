import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const demand = await prisma.demand.update({
      where: { id },
      // Clearing the boost also means the author can't reopen it by extending.
      data: { status: "EXPIRED", isPriority: false, priorityExpiresAt: null },
      select: { id: true, status: true },
    });

    return NextResponse.json({ demand });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands/force-expire: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this post.");
  }
}
