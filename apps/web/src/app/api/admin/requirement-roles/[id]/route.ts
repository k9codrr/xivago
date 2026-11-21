import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { requirementRolePatchSchema } from "@/lib/validation/requirement-role";

type RouteContext = { params: Promise<{ id: string }> };

/** Rename, describe, reorder, hide or show a role. A rename also shows on existing posts. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = requirementRolePatchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiValidationError(parsed.error);
    const data = parsed.data;

    if (data.name) {
      const duplicate = await prisma.requirementRole.findFirst({
        where: { id: { not: id }, name: { equals: data.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (duplicate) return apiError(409, "DUPLICATE_ROLE", "A role with this name already exists.");
    }

    const role = await prisma.requirementRole
      .update({ where: { id }, data: { ...data, ...(data.description === "" ? { description: null } : {}) } })
      .catch(() => null);
    if (!role) return apiError(404, "NOT_FOUND", "Role not found.");
    return NextResponse.json({ role });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/requirement-roles PATCH: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update the role.");
  }
}

/** Only an unused role can be deleted, so a post never loses the role it asked for. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;

    const role = await prisma.requirementRole.findUnique({
      where: { id },
      select: { _count: { select: { demands: true } } },
    });
    if (!role) return apiError(404, "NOT_FOUND", "Role not found.");
    if (role._count.demands > 0) {
      return apiError(409, "ROLE_IN_USE", `${role._count.demands} post(s) use this role. Hide it instead.`);
    }

    await prisma.requirementRole.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/requirement-roles DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete the role.");
  }
}
