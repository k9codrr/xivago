import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import { notifyNewFollower } from "@/lib/notifications";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: targetId } = await params;

    if (targetId === user.id) return apiError(400, "CANNOT_FOLLOW_SELF", "You can't follow yourself.");

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

    // createMany + skipDuplicates (rather than upsert) so we know whether this
    // was a new follow -- only new follows trigger a notification.
    const { count } = await prisma.follow.createMany({
      data: [{ followerId: user.id, followingId: targetId }],
      skipDuplicates: true,
    });
    if (count > 0) void notifyNewFollower(user.id, targetId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/follow POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not follow this user.");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id: targetId } = await params;

    await prisma.follow.deleteMany({ where: { followerId: user.id, followingId: targetId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("users/follow DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not unfollow this user.");
  }
}
