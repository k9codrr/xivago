import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";

const bodySchema = z.object({
  action: z.enum(["dismiss", "remove_content"]),
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

    const report = await prisma.forumReport.findUnique({ where: { id } });
    if (!report) return apiError(404, "NOT_FOUND", "This report doesn't exist.");

    if (parsed.data.action === "remove_content") {
      if (report.targetType === "MESSAGE") {
        await prisma.forumMessage.update({ where: { id: report.targetId }, data: { deletedAt: new Date() } });
      } else {
        await prisma.forumComment.update({ where: { id: report.targetId }, data: { deletedAt: new Date() } });
      }
    }

    const updated = await prisma.forumReport.update({
      where: { id },
      data: { status: parsed.data.action === "remove_content" ? "RESOLVED" : "DISMISSED" },
    });

    return NextResponse.json({ report: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("admin/forum/reports/resolve: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not update this report.");
  }
}
