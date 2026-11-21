import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { removePlacement } from "@/lib/featured";
import { deliverPendingNotifications } from "@/lib/notifications";

/** Pull a live placement (e.g. after a report). Ranks below move up; the seller is refunded pro-rata. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const placement = await prisma.featuredPlacement.findUnique({ where: { id }, select: { status: true } });
    if (!placement) return apiError(404, "NOT_FOUND", "Placement not found.");
    if (placement.status !== "ACTIVE") return apiError(409, "CONFLICT", "This placement is no longer live.");

    await removePlacement(id, "admin-removed");
    void deliverPendingNotifications();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/featured/placements remove: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not remove the placement.");
  }
}
