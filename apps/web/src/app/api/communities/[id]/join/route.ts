import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError, ForbiddenError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const community = await prisma.community.findUnique({ where: { id }, select: { id: true } });
    if (!community) return apiError(404, "NOT_FOUND", "This community doesn't exist.");

    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: id, userId: user.id } },
      update: {},
      create: { communityId: id, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("communities/join POST: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not join this community.");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const community = await prisma.community.findUnique({ where: { id }, select: { creatorId: true } });
    if (!community) return apiError(404, "NOT_FOUND", "This community doesn't exist.");
    if (community.creatorId === user.id) {
      return apiError(400, "CREATOR_CANNOT_LEAVE", "As the creator, you can't leave your own community.");
    }

    await prisma.communityMember.deleteMany({ where: { communityId: id, userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "You must be signed in.");
    if (err instanceof ForbiddenError) return apiError(403, "FORBIDDEN", err.message);
    console.error("communities/join DELETE: unexpected error", err);
    return apiError(500, "INTERNAL_ERROR", "Could not leave this community.");
  }
}
