import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    // Hard delete, per section 3.12's literal "delete" (as opposed to the
    // author-facing soft "close" at PATCH /api/demands/[id]/close). Bids/
    // Conversations/Messages cascade via onDelete: Cascade in the schema.
    await prisma.demand.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/demands DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete this post.");
  }
}
