import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const demand = await prisma.demand.findUnique({
      where: { id },
      select: { id: true, authorId: true, status: true },
    });
    if (!demand) return apiError(404, "NOT_FOUND", "This request doesn't exist.");

    if (demand.authorId !== user.id && !user.isAdmin) {
      return apiError(403, "FORBIDDEN", "Only the person who posted this can close it.");
    }
    if (demand.status !== "OPEN") {
      return apiError(409, "CONFLICT", `This request is already closed.`);
    }

    const updated = await prisma.demand.update({
      where: { id },
      data: { status: "FILLED" },
      select: { id: true, status: true },
    });

    return NextResponse.json({ demand: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands/close: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not close this request.");
  }
}
