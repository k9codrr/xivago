import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, UnauthorizedError } from "@/lib/guards";
import { apiError } from "@/lib/api-response";
import type { MentionCommunity } from "@/components/forum/types";

/** How many suggestions the @-mention list shows. */
const LIMIT = 8;
/** Cap on joined communities scanned for ranking (people rarely join more). */
const MAX_JOINED = 300;

/**
 * Closeness of a community to what the user typed after "@":
 * exact > prefix of slug/name > prefix of a word in the name > anywhere. Lower is closer.
 */
function rank(q: string, c: { name: string; slug: string }): number {
  if (!q) return 0;
  const name = c.name.toLowerCase();
  const slug = c.slug.toLowerCase();
  if (slug === q || name === q) return 0;
  if (slug.startsWith(q) || name.startsWith(q)) return 1;
  if (name.split(/[\s\-_]+/).some((w) => w.startsWith(q))) return 2;
  if (slug.includes(q) || name.includes(q)) return 3;
  return Infinity;
}

/**
 * GET /api/communities/mentions?q=des
 * Suggestions for "@" mentions in the composer: communities the viewer has joined
 * first (closest match first, then most recently joined), topped up with other
 * matching communities when there are fewer than LIMIT.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 60);

    const memberships = await prisma.communityMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: "desc" },
      take: MAX_JOINED,
      select: {
        community: {
          select: { id: true, name: true, slug: true, coverImage: true, _count: { select: { members: true } } },
        },
      },
    });

    // Stable sort keeps "most recently joined" order within the same rank
    const joined = memberships
      .map((m, order) => ({ c: m.community, r: rank(q, m.community), order }))
      .filter((x) => x.r !== Infinity)
      .sort((a, b) => a.r - b.r || a.order - b.order)
      .slice(0, LIMIT)
      .map(({ c }) => c);

    let others: typeof joined = [];
    if (q && joined.length < LIMIT) {
      const joinedIds = memberships.map((m) => m.community.id);
      const found = await prisma.community.findMany({
        where: {
          id: { notIn: joinedIds },
          OR: [{ slug: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
        },
        select: { id: true, name: true, slug: true, coverImage: true, _count: { select: { members: true } } },
        orderBy: { members: { _count: "desc" } },
        take: 25,
      });
      others = found
        .map((c) => ({ c, r: rank(q, c) }))
        .sort((a, b) => a.r - b.r)
        .slice(0, LIMIT - joined.length)
        .map(({ c }) => c);
    }

    const shape = (isMember: boolean) => (c: (typeof joined)[number]): MentionCommunity => ({
      kind: "community",
      id: c.id,
      name: c.name,
      slug: c.slug,
      coverImage: c.coverImage,
      memberCount: c._count.members,
      isMember,
    });

    return NextResponse.json({ suggestions: [...joined.map(shape(true)), ...others.map(shape(false))] });
  } catch (err) {
    if (err instanceof UnauthorizedError) return apiError(401, "UNAUTHORIZED", "Sign in to mention communities.");
    throw err;
  }
}
