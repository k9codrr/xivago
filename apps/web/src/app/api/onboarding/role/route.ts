import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { roleChoiceSchema } from "@/lib/validation/auth";
import { normalizeProfileCategories } from "@/lib/category-selection";

const categoryIds = z.array(z.string().trim().min(1).max(20)).max(50).optional();

const bodySchema = z.object({
  role: roleChoiceSchema,
  // Optional for providers: what they offer (sub -> provider -> problems).
  categorySubIds: categoryIds,
  categoryProviderIds: categoryIds,
  categoryProblemIds: categoryIds,
});

/**
 * Scoped to exactly one field so the onboarding screen (§3.1) doesn't need
 * to wait on the full `/api/users/me` profile-edit route, which is M2 scope
 * per §6/§9. Revisit: once M2 ships, this can just delegate to that route.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { role, ...picks } = parsed.data;
    const hasPicks = Object.values(picks).some((ids) => ids && ids.length > 0);

    await prisma.user.update({
      where: { id: user.id },
      data: { role, ...(hasPicks ? normalizeProfileCategories(picks) : {}) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("onboarding/role: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not save your role.");
  }
}
