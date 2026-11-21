import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser, requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { getForumPost } from "@/lib/forum-post";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getOptionalUser();
  const { id } = await params;
  const post = await getForumPost(id, viewer?.id ?? null);
  if (!post) return apiError(404, "NOT_FOUND", "This post doesn't exist.");
  return NextResponse.json({ post });
}

/** Soft delete -- own post or admin, per section 3.9 ("Delete: own messages + admin (soft deletedAt)"). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const post = await prisma.forumMessage.findUnique({ where: { id }, select: { senderId: true, deletedAt: true } });
    if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");
    if (post.senderId !== user.id && !user.isAdmin) {
      return apiError(403, "FORBIDDEN", "You can only delete your own posts.");
    }

    await prisma.forumMessage.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id] DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not delete this post.");
  }
}
