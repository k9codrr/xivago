import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({
  // "resolve" = handled (e.g. the admin already expired the post or banned the
  // user from the Posts/Users pages); "dismiss" = no action needed.
  action: z.enum(["resolve", "dismiss"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const report = await prisma.report.findUnique({ where: { id }, select: { id: true } });
    if (!report) return apiError(404, "NOT_FOUND", "This report doesn't exist.");

    const updated = await prisma.report.update({
      where: { id },
      data: {
        status: parsed.data.action === "resolve" ? "RESOLVED" : "DISMISSED",
        resolvedAt: new Date(),
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ report: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/reports/resolve: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this report.");
  }
}
