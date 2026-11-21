import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { reportReference } from "@/lib/validation/report";

/** Open post/user reports filed from demand detail pages, newest first. */
export async function GET() {
  try {
    await requireAdmin();

    const reports = await prisma.report.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        targetType: true,
        reason: true,
        details: true,
        createdAt: true,
        demand: { select: { id: true, summary: true, status: true } },
        reportedUser: { select: { id: true, name: true, email: true, isBanned: true } },
        reporter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      reports: reports.map((r) => ({ ...r, reference: reportReference(r.id) })),
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/reports GET: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not load reports.");
  }
}
