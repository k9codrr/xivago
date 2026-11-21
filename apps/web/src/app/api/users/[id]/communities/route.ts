import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

/** Communities a user has joined, most recently joined first. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOptionalUser();

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return apiError(404, "NOT_FOUND", "This user doesn't exist.");

  const memberships = await prisma.communityMember.findMany({
    where: { userId: id },
    orderBy: { joinedAt: "desc" },
    take: 200,
    select: {
      community: {
        select: {
          id: true,
          name: true,
          description: true,
          coverImage: true,
          _count: { select: { members: true, posts: true } },
        },
      },
    },
  });
  const communities = memberships.map((m) => m.community);

  let viewerMemberOf = new Set<string>();
  if (viewer) {
    const rows =
      viewer.id === id
        ? communities.map((c) => ({ communityId: c.id }))
        : await prisma.communityMember.findMany({
            where: { userId: viewer.id, communityId: { in: communities.map((c) => c.id) } },
            select: { communityId: true },
          });
    viewerMemberOf = new Set(rows.map((r) => r.communityId));
  }

  return NextResponse.json({
    communities: communities.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      coverImage: c.coverImage,
      memberCount: c._count.members,
      postCount: c._count.posts,
      isMember: viewerMemberOf.has(c.id),
    })),
  });
}
