import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOptionalUser } from "@/lib/guards";
import { apiValidationError } from "@/lib/api-response";
import { communityFeedQuerySchema } from "@/lib/validation/community";

const COMMUNITY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  coverImage: true,
  createdAt: true,
  creator: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { members: true, posts: true } },
} as const;

export async function GET(req: NextRequest) {
  const viewer = await getOptionalUser();

  const url = new URL(req.url);
  const parsed = communityFeedQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return apiValidationError(parsed.error);
  const { q, cursor, limit, mine } = parsed.data;

  if (mine) {
    if (!viewer) return NextResponse.json({ communities: [], nextCursor: null });
    const memberships = await prisma.communityMember.findMany({
      where: { userId: viewer.id },
      orderBy: { joinedAt: "desc" },
      take: limit,
      select: { community: { select: { id: true, name: true, slug: true, coverImage: true } } },
    });
    return NextResponse.json({ communities: memberships.map((m) => m.community), nextCursor: null });
  }

  const nameFilter = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  // Joined communities lead the list: they all come on the first page (most
  // recently joined first), and the paged remainder excludes them so none
  // shows twice.
  const joinedIds = viewer
    ? (
        await prisma.communityMember.findMany({
          where: { userId: viewer.id },
          orderBy: { joinedAt: "desc" },
          select: { communityId: true },
        })
      ).map((m) => m.communityId)
    : [];

  const joined =
    !cursor && joinedIds.length
      ? await prisma.community
          .findMany({ where: { id: { in: joinedIds }, ...nameFilter }, select: COMMUNITY_SELECT })
          .then((rows) => rows.sort((a, b) => joinedIds.indexOf(a.id) - joinedIds.indexOf(b.id)))
      : [];

  const others = await prisma.community.findMany({
    where: { ...nameFilter, ...(joinedIds.length ? { id: { notIn: joinedIds } } : {}) },
    select: COMMUNITY_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = others.length > limit;
  const othersPage = hasMore ? others.slice(0, limit) : others;
  const page = [...joined, ...othersPage];
  const memberOf = new Set(joinedIds);

  const shaped = page.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    coverImage: c.coverImage,
    createdAt: c.createdAt,
    creator: c.creator,
    memberCount: c._count.members,
    postCount: c._count.posts,
    isMember: memberOf.has(c.id),
  }));

  return NextResponse.json({ communities: shaped, nextCursor: hasMore ? othersPage[othersPage.length - 1]?.id ?? null : null });
}
