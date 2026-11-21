import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({ banned: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (id === admin.id) return apiError(400, "CANNOT_SELF_BAN", "You can't ban your own account.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const user = await prisma.user.update({
      where: { id },
      data: { isBanned: parsed.data.banned },
      select: { id: true, isBanned: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/users/ban: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this user.");
  }
}
