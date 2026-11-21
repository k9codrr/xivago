import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** Idempotent: reposting twice is a no-op. Returns the fresh count so the client can reconcile. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const post = await prisma.forumMessage.findUnique({ where: { id }, select: { deletedAt: true } });
    if (!post || post.deletedAt) return apiError(404, "NOT_FOUND", "This post doesn't exist.");

    await prisma.forumRepost.upsert({
      where: { userId_postId: { userId: user.id, postId: id } },
      create: { userId: user.id, postId: id },
      update: {},
    });
    const count = await prisma.forumRepost.count({ where: { postId: id } });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/repost POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not repost this post.");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await prisma.forumRepost.deleteMany({ where: { userId: user.id, postId: id } });
    const count = await prisma.forumRepost.count({ where: { postId: id } });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("forum/[id]/repost DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not undo your repost.");
  }
}
