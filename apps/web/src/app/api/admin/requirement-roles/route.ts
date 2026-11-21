import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { requirementRoleCreateSchema } from "@/lib/validation/requirement-role";

export async function GET() {
  try {
    await requireAdmin();
    const roles = await prisma.requirementRole.findMany({
      include: { _count: { select: { demands: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ roles });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/requirement-roles GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load roles.");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = requirementRoleCreateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const { name, description, sortOrder } = parsed.data;

    const duplicate = await prisma.requirementRole.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) return apiError(409, "DUPLICATE_ROLE", "A role with this name already exists.");

    // New roles go to the end of the list unless the admin chose a position.
    let position = sortOrder;
    if (position == null) {
      const last = await prisma.requirementRole.aggregate({ _max: { sortOrder: true } });
      position = (last._max.sortOrder ?? 0) + 10;
    }

    const role = await prisma.requirementRole.create({
      data: { name, description: description || null, sortOrder: position },
    });
    return NextResponse.json({ role }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/requirement-roles POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not create the role.");
  }
}
