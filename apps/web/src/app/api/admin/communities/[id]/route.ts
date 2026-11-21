import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { communityCoverSchema } from "@/lib/validation/community";

/** Sets a community's cover image. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = communityCoverSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { count } = await prisma.community.updateMany({ where: { id }, data: { coverImage: parsed.data.coverImage } });
    if (count === 0) return apiError(404, "NOT_FOUND", "This community doesn't exist.");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/communities PATCH: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this community.");
  }
}
