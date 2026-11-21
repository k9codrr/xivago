import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { reportSchema, reportReference } from "@/lib/validation/report";

/**
 * Report a demand, or the user who posted it. The reported user is resolved
 * here from the demand rather than sent by the client, so reporting an
 * anonymous poster never reveals who they are.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const demand = await prisma.demand.findUnique({ where: { id }, select: { id: true, authorId: true } });
    if (!demand) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);
    const { target, reason, details } = parsed.data;

    if (demand.authorId === user.id) {
      return apiError(400, "SELF_REPORT", "You can't report your own post.");
    }

    // One open report per reporter per target is enough; hand back the
    // existing reference instead of piling up duplicates.
    const existing = await prisma.report.findFirst({
      where: { reporterId: user.id, demandId: demand.id, targetType: target, status: "OPEN" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        reference: reportReference(existing.id),
        message: "You've already reported this. Our team is reviewing it.",
      });
    }

    const report = await prisma.report.create({
      data: {
        targetType: target,
        demandId: demand.id,
        reportedUserId: demand.authorId,
        reporterId: user.id,
        reason,
        details: details || null,
      },
      select: { id: true },
    });

    return NextResponse.json(
      { ok: true, reference: reportReference(report.id), message: "Thanks. Our team will take a look." },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "Sign in to report.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("demands/[id]/report POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not submit your report.");
  }
}
