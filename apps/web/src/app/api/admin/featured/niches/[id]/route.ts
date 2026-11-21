import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { featuredNichePatchSchema } from "@/lib/validation/featured";

/** Switch a niche between FIXED and AUCTION, pause it, or change its prices. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = featuredNichePatchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);

    const niche = await prisma.featuredNiche.update({ where: { id }, data: parsed.data }).catch(() => null);
    if (!niche) return apiError(404, "NOT_FOUND", "Niche not found.");
    return NextResponse.json({ niche });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/featured/niches PATCH: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update the niche.");
  }
}
