import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiError } from "@/lib/api-response";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOptionalUser();

  const community = await prisma.community.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      coverImage: true,
      createdAt: true,
      creator: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { members: true, posts: true } },
    },
  });
  if (!community) return apiError(404, "NOT_FOUND", "This community doesn't exist.");

  let isMember = false;
  if (viewer) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId: viewer.id } },
    });
    isMember = Boolean(membership);
  }

  return NextResponse.json({
    community: {
      id: community.id,
      name: community.name,
      slug: community.slug,
      description: community.description,
      coverImage: community.coverImage,
      createdAt: community.createdAt,
      creator: community.creator,
      memberCount: community._count.members,
      postCount: community._count.posts,
      isMember,
      isCreator: viewer?.id === community.creator.id,
    },
  });
}
