import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOptionalUser();

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

  const rows = await prisma.follow.findMany({
    where: { followerId: id },
    select: { following: { select: { id: true, name: true, avatarUrl: true, companyName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let followedByViewer = new Set<string>();
  if (viewer) {
    const viewerFollows = await prisma.follow.findMany({
      where: { followerId: viewer.id, followingId: { in: rows.map((r) => r.following.id) } },
      select: { followingId: true },
    });
    followedByViewer = new Set(viewerFollows.map((f) => f.followingId));
  }

  return NextResponse.json({
    users: rows.map((r) => ({ ...r.following, isFollowedByViewer: followedByViewer.has(r.following.id) })),
  });
}
