import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const comment = await prisma.forumComment.findUnique({ where: { id }, select: { senderId: true, deletedAt: true } });
    if (!comment || comment.deletedAt) return apiError(404, "NOT_FOUND", "This comment doesn't exist.");
    if (comment.senderId !== user.id && !user.isAdmin) {
      return apiError(403, "FORBIDDEN", "You can only delete your own comments.");
    }

    await prisma.forumComment.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/comments/[id] DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete this comment.");
  }
}
