import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError, apiValidationError } from "@/lib/api-response";
import { forumReportSchema } from "@/lib/validation/forum";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const comment = await prisma.forumComment.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!comment || comment.deletedAt) return apiError(404, "NOT_FOUND", "This comment doesn't exist.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }
    const parsed = forumReportSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    await prisma.forumReport.create({
      data: { targetType: "COMMENT", targetId: id, reporterId: user.id, reason: parsed.data.reason },
    });

    return NextResponse.json({ ok: true, message: "Thanks — our team will take a look." }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/comments/[id]/report POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not submit your report.");
  }
}
